from tabulate import tabulate
from app.modules.heat_pump_integration.hpi_plot import HPIPlot
from app.modules.utility.temperature_pocket_deletion import TemperaturePocketDeletion as TPD


# Operating window of each heat pump technology: the sink temperature range it
# is built for and the temperature lift it can deliver. Single source of truth —
# COP(), COP_specific(), get_available_heat_pumps() and the exclusion messages
# in analysis_service all read this table instead of repeating the numbers.
HP_OPERATING_WINDOWS = {
    'Prototypical Stirling':   {'t_sink_min': 144, 't_sink_max': 212, 'dt_min': 25, 'dt_max': 190},
    'VHTHP (HFC/HFO)':         {'t_sink_min': 80,  't_sink_max': 160, 'dt_min': 25, 'dt_max': 95},
    'SHP and HTHPs (HFC/HFO)': {'t_sink_min': 25,  't_sink_max': 100, 'dt_min': 10, 'dt_max': 78},
    'SHP and HTHPs (R717)':    {'t_sink_min': 70,  't_sink_max': 85,  'dt_min': 30, 'dt_max': 75},
    'Carnot':                  {'t_sink_min': -273, 't_sink_max': 10000, 'dt_min': 0, 'dt_max': 10000},
}

# Regression fits, one per technology. Each takes the sink temperature (°C) and
# the lift (°C) and returns the COP. Only valid inside the matching window above.
HP_COP_CORRELATIONS = {
    'Prototypical Stirling':
        lambda t_sink, dt: 1.28792 * (dt + 2 * 0.54103) ** (-0.37606) * (t_sink + 273 + 0.54103) ** 0.35992,
    'VHTHP (HFC/HFO)':
        lambda t_sink, dt: 1.9118 * (dt + 2 * 0.04419) ** (-0.89094) * (t_sink + 273 + 0.04419) ** 0.67895,
    'SHP and HTHPs (HFC/HFO)':
        lambda t_sink, dt: 1.4480 * (10 ** 12) * (dt + 2 * 88.73) ** (-4.9469),
    'SHP and HTHPs (R717)':
        lambda t_sink, dt: 40.789 * (dt + 2 * 1.0305) ** (-1.0489) * (t_sink + 273 + 1.0305) ** 0.29998,
    'Carnot':
        lambda t_sink, dt: carnot_cop(t_sink, dt),
}

# String templates to show the user exactly what was calculated.
HP_COP_FORMULAS = {
    'Prototypical Stirling':
        lambda t_sink, dt: f"1.288 * ((T_sink - T_source) + 1.08)^-0.38 * (T_sink + 273.5)^0.36\n= 1.28792 * (({t_sink:.1f} - {t_sink - dt:.1f}) + 1.08206)^-0.37606 * ({t_sink:.1f} + 273.54103)^0.35992",
    'VHTHP (HFC/HFO)':
        lambda t_sink, dt: f"1.912 * ((T_sink - T_source) + 0.09)^-0.89 * (T_sink + 273.0)^0.68\n= 1.9118 * (({t_sink:.1f} - {t_sink - dt:.1f}) + 0.08838)^-0.89094 * ({t_sink:.1f} + 273.04419)^0.67895",
    'SHP and HTHPs (HFC/HFO)':
        lambda t_sink, dt: f"1.448e12 * ((T_sink - T_source) + 177.46)^-4.9469\n= 1.4480e12 * (({t_sink:.1f} - {t_sink - dt:.1f}) + 177.46)^-4.9469",
    'SHP and HTHPs (R717)':
        lambda t_sink, dt: f"40.789 * ((T_sink - T_source) + 2.06)^-1.05 * (T_sink + 274.0)^0.30\n= 40.789 * (({t_sink:.1f} - {t_sink - dt:.1f}) + 2.061)^-1.0489 * ({t_sink:.1f} + 274.0305)^0.29998",
    'Carnot':
        lambda t_sink, dt: f"COP_carnot = T_sink(K) / (T_sink - T_source) * 0.5\n= ({t_sink:.1f} + 273.15) / ({t_sink:.1f} - {t_sink - dt:.1f}) * 0.5",
}


def carnot_cop(t_sink, dt):
    """Carnot COP at 50 % efficiency — the generic fallback for 'any heat pump'."""
    return (t_sink + 273.15) / dt * 0.5


def in_operating_window(hp_type, t_sink, dt):
    """True when `hp_type` is rated for this sink temperature and lift."""
    w = HP_OPERATING_WINDOWS.get(hp_type)
    if w is None:
        return False
    return (w['t_sink_min'] <= t_sink <= w['t_sink_max']
            and w['dt_min'] <= dt <= w['dt_max'])


class HeatPumpOutOfRange(ValueError):
    """
    A named heat pump technology was asked for a duty outside its rating.

    Raised instead of quietly substituting the Carnot fallback, which used to
    make an out-of-window technology look available under a COP that was never
    its own.
    """

    def __init__(self, hp_type, t_sink, t_source):
        self.hp_type = hp_type
        self.t_sink = t_sink
        self.t_source = t_source
        self.delta_t = None if t_sink is None or t_source is None else t_sink - t_source
        super().__init__(
            f"{hp_type} is not rated for T_sink={t_sink:.1f}°C with a lift of "
            f"{self.delta_t:.1f}°C."
        )


class HeatPumpIntegration():
    def __init__(self, streams_data_file, t_sink_out, pyPinch, options=()):
        self.integration_type = None
        if t_sink_out == None:
            self.integration_type = 'Itterativ'
        self.process_designation = streams_data_file[:-4]
        self.streams_data_file = streams_data_file
        self.options = set(options)
        self.ko_wp = []
        self.ev_wp = []
        self.cop_werte = []
        self.cop_t = []
        self.step_size_temp = 0.05
        self.t_sink_out = t_sink_out

        self.pyPinch = pyPinch
        if hasattr(pyPinch, 'pinch_analyse'):
            self.tmin = pyPinch.pinch_analyse.tmin
        elif hasattr(pyPinch, 'tmin'):
            self.tmin = pyPinch.tmin
        else:
            self.tmin = 0

    def _check_lift(self, T):
        """
        A heat pump needs a positive temperature lift.

        With the pocket-free GCC the source always sits below the pinch and the
        sink above it, so this never binds. The uncascaded and composite
        profiles have no pinch, so their source and sink temperature ranges can
        overlap and T can reach t_sink_out — which would divide by zero in the
        Carnot fallback below.
        """
        if self.t_sink_out is not None and self.t_sink_out - T <= 0:
            raise ValueError(
                f"No temperature lift available: source {T:.1f}°C is not below "
                f"sink {self.t_sink_out:.1f}°C."
            )

    def COP(self,T):
        """
        Best COP available at source temperature T, across every technology
        rated for this operating point.

        Falls back to Carnot only when no named technology applies — this is the
        deliberate "any heat pump" mode. Use COP_specific() when the answer has
        to belong to one named technology.
        """
        self._check_lift(T)
        delta_T = self.t_sink_out - T

        candidates = [
            (correlation(self.t_sink_out, delta_T), hp_type)
            for hp_type, correlation in HP_COP_CORRELATIONS.items()
            if in_operating_window(hp_type, self.t_sink_out, delta_T)
        ]
        
        # key= so ties keep the first technology listed, as the original did
        cop, hp = max(candidates, key=lambda c: c[0])
        return min(cop, 15.0), hp

    def get_available_heat_pumps(self, T):
        """Returns list of all heat pump types with their COPs and availability status"""
        hp_list = []
        delta_T = self.t_sink_out - T

        for hp_type, correlation in HP_COP_CORRELATIONS.items():
            if in_operating_window(hp_type, self.t_sink_out, delta_T):
                hp_list.append({
                    'name': hp_type,
                    'cop': min(correlation(self.t_sink_out, delta_T), 15.0),
                    'available': True,
                    'reason': '',
                })
            else:
                w = HP_OPERATING_WINDOWS[hp_type]
                hp_list.append({
                    'name': hp_type,
                    'cop': None,
                    'available': False,
                    'reason': (
                        f"Requires: {w['t_sink_min']}°C≤T_sink≤{w['t_sink_max']}°C, "
                        f"{w['dt_min']}°C≤ΔT≤{w['dt_max']}°C "
                        f"(Current: T_sink={self.t_sink_out:.1f}°C, ΔT={delta_T:.1f}°C)"
                    ),
                })

        return hp_list

    def COP_specific(self, T, hp_type):
        """
        COP of one named technology at source temperature T.

        Raises HeatPumpOutOfRange when the operating point falls outside that
        technology's rating. It must not silently return the Carnot fallback:
        doing so reported unrelated technologies as available under a COP that
        was really just Carnot, and made several of them come out identical.
        """
        self._check_lift(T)
        delta_T = self.t_sink_out - T

        if hp_type not in HP_COP_CORRELATIONS:
            raise ValueError(f"Unknown heat pump type '{hp_type}'.")

        if not in_operating_window(hp_type, self.t_sink_out, delta_T):
            raise HeatPumpOutOfRange(hp_type, self.t_sink_out, T)

        cop = HP_COP_CORRELATIONS[hp_type](self.t_sink_out, delta_T)
            
        return min(cop, 15.0)

    def delete_temperature_pockets(self):
        self.pyPinch = self.pyPinch.pinch_analyse
        self.hot_utility = self.pyPinch.hot_utility
        self.tmin = self.pyPinch.tmin
        # TPD rewrites the temperature list and the cascade in place when it cuts
        # a pocket. Hand it copies, otherwise the pinch object is destroyed for
        # every caller after the first one — evaluating a second heat pump type
        # against the same analysis used to fail with an IndexError.
        self.heat_cascade = [dict(row) for row in self.pyPinch.heat_cascade]
        self._temperatures = list(self.pyPinch._temperatures)
        self.deletedPocketdict = TPD(self.hot_utility, self.heat_cascade, self._temperatures).delete_temperature_pockets()

    def split_hot_and_cold(self):
        self.splitHotTemperatures = []
        self.splitColdTemperatures = []
        self.splitHotH = []
        self.splitColdH = []
        testHot = 0
        testCold = 0
    
        for i in range(len(self.deletedPocketdict['T'][0])):
            if i >= len(self.deletedPocketdict['deltaH'][0]):
                continue
            if self.deletedPocketdict['deltaH'][0][i] > 0 and testHot == 0:
                    self.splitHotTemperatures.append(self.deletedPocketdict['T'][0][i])
                    self.splitHotH.append(self.deletedPocketdict['H'][0][i])
                    self.splitHotTemperatures.append(self.deletedPocketdict['T'][0][i+1])
                    self.splitHotH.append(self.deletedPocketdict['H'][0][i+1])
                    testHot = 1

            elif self.deletedPocketdict['deltaH'][0][i] > 0 and testHot == 1:
                    self.splitHotTemperatures.append(self.deletedPocketdict['T'][0][i+1])
                    self.splitHotH.append(self.deletedPocketdict['H'][0][i+1])

            elif self.deletedPocketdict['deltaH'][0][i] < 0 and testCold == 0:
                    self.splitColdTemperatures.append(self.deletedPocketdict['T'][0][i])
                    self.splitColdH.append(self.deletedPocketdict['H'][0][i])
                    self.splitColdTemperatures.append(self.deletedPocketdict['T'][0][i+1])
                    self.splitColdH.append(self.deletedPocketdict['H'][0][i+1])
                    testCold = 1
            elif self.deletedPocketdict['deltaH'][0][i] < 0 and testCold == 1:
                    self.splitColdTemperatures.append(self.deletedPocketdict['T'][0][i+1])
                    self.splitColdH.append(self.deletedPocketdict['H'][0][i+1])
            elif self.deletedPocketdict['deltaH'][0][i] == 0:
                    if self.deletedPocketdict['deltaH'][0][i-1] < 0:
                        self.splitColdTemperatures.append(self.deletedPocketdict['T'][0][i+1])
                        self.splitColdH.append(self.deletedPocketdict['H'][0][i+1])

                    elif self.deletedPocketdict['deltaH'][0][i-1] > 0:
                        self.splitHotTemperatures.append(self.deletedPocketdict['T'][0][i+1])
                        self.splitHotH.append(self.deletedPocketdict['H'][0][i+1])
                    else:
                        pass

            else:
                    pass
        
        

        self.splitColddeltaH = []
        self.splitHotdeltaH = []                
        for i in range(len(self.splitColdH)-1):
            self.splitColddeltaH.append(self.splitColdH[i+1]-self.splitColdH[i])

        for i in range(len(self.splitHotH)-1):
            self.splitHotdeltaH.append(self.splitHotH[i+1]-self.splitHotH[i])   
            
        return {'H':self.splitHotH, 'T':self.splitHotTemperatures, 'deltaH':self.splitHotdeltaH},{'H':self.splitColdH, 'T':self.splitColdTemperatures, 'deltaH':self.splitColddeltaH}
    
    def q_punkt_ev(self,T,Quelle): # FEHLER
        return self.gcc_source['H'][Quelle] + ((self.gcc_source['H'][Quelle+1]-self.gcc_source['H'][Quelle])/(self.gcc_source['T'][Quelle+1]-self.gcc_source['T'][Quelle])) * (T-self.gcc_source['T'][Quelle])
    
    def q_punkt_ko(self,T,Quelle):
        return self.gcc_sink['H'][Quelle-1] + ((self.gcc_sink['H'][Quelle-1]-self.gcc_sink['H'][Quelle])/(self.gcc_sink['T'][Quelle-1]-self.gcc_sink['T'][Quelle])) * (T-self.gcc_sink['T'][Quelle-1])

    def t_ko(self,H,Quelle):
        return self.gcc_sink['T'][Quelle] - ((self.gcc_sink['T'][Quelle]-self.gcc_sink['T'][Quelle+1])/(self.gcc_sink['H'][Quelle]-self.gcc_sink['H'][Quelle+1])) * (self.gcc_sink['H'][Quelle]-H)

    def integrate_heat_pump(self):
        Test = 0
        TSTest = 0

        #Starttemperatur
        if self.integration_type == 'Itterativ':
            self.t_sink_out = self.gcc_sink['T'][0]
        else:
            pass
        Quelle = 0
        self.step_size_temp = (self.gcc_source['T'][Quelle] - self.gcc_source['T'][Quelle+1])/10
        T = self.gcc_source['T'][Quelle]-self.step_size_temp

        while T > self.gcc_source['T'][-1]:
            if T <= self.gcc_source['T'][Quelle+1]:
                Quelle +=1
                self.step_size_temp = (self.gcc_source['T'][Quelle] - self.gcc_source['T'][Quelle+1])/10
                T = self.gcc_source['T'][Quelle]-self.step_size_temp
                if self.gcc_source['deltaH'][Quelle] == 0.0:
                    Quelle +=1
                    self.step_size_temp = (self.gcc_source['T'][Quelle] - self.gcc_source['T'][Quelle+1])/10
                    T = self.gcc_source['T'][Quelle]-self.step_size_temp
            if T < self.gcc_source['T'][Quelle+1]:
                T = self.gcc_source['T'][Quelle+1]
            # Source and sink ranges overlap in the uncascaded/composite
            # profiles — walk down past any source point without a lift.
            if self.t_sink_out is not None and T >= self.t_sink_out:
                T -= max(self.step_size_temp, 1e-6)
                continue
            COP = self.COP(T)
            q_punkt_ev = self.q_punkt_ev(T,Quelle)
            q_punkt_ko = q_punkt_ev * ((1-(1/COP[0]))**(-1))
            self.cop_werte.append(round(COP[0],3))
            self.ev_wp.append(round(q_punkt_ev))
            self.ko_wp.append(round(q_punkt_ko))
            self.cop_t.append(T)
            for i in range(len(self.gcc_sink['T'])):
                if self.gcc_sink['T'][i] <= self.t_sink_out:
                    KoQuelle = i
                    break
            if q_punkt_ko >= self.q_punkt_ko(self.t_sink_out, KoQuelle) and self.integration_type == None and TSTest == 1 and self.t_sink_out < self.gcc_sink['T'][0]:
                break
            if q_punkt_ko >= self.q_punkt_ko(self.t_sink_out, KoQuelle) and self.integration_type == None and TSTest == 0:
                if self.t_sink_out <= self.gcc_sink['T'][0]:
                    T+=self.step_size_temp
                    self.step_size_temp = self.step_size_temp/200
                    TSTest = 1
                else:
                    break
            if q_punkt_ko >= self.gcc_sink['H'][0] and Test == 0:
                T+=self.step_size_temp
                self.step_size_temp = self.step_size_temp/200
                Test = 1
            elif q_punkt_ko >= self.gcc_sink['H'][0] and Test == 1:
                break
            T -= max(self.step_size_temp, 1e-6)
            if T < self.gcc_source['T'][Quelle+1]:
                T = self.gcc_source['T'][Quelle+1]

            if T <= self.gcc_source['T'][-1]:
                T = self.gcc_source['T'][-1]
                COP = self.COP(T)
                q_punkt_ev = self.gcc_source['H'][-1]
                q_punkt_ko = q_punkt_ev * (1-(1/COP[0]))**(-1)
                if self.integration_type == 'Itterativ':
                    for i in range(len(self.gcc_sink['H'])):
                        if q_punkt_ko >= self.gcc_sink['H'][i]:
                            QuelleSenke = i-1
                            break
                    self.t_sink_out = self.t_ko(q_punkt_ko,QuelleSenke)
                    COP = self.COP(T)
                    q_punkt_ko = q_punkt_ev * (1-(1/COP[0]))**(-1)
                    TSinktest = self.t_ko(q_punkt_ko, QuelleSenke)
                    while abs(self.t_sink_out - TSinktest) >= 1:
                        for i in range(len(self.gcc_sink['H'])):
                            if q_punkt_ko >= self.gcc_sink['H'][i]:
                                QuelleSenke = i-1
                                break
                        self.t_sink_out = self.t_ko(q_punkt_ko,QuelleSenke)
                        COP = self.COP(T)
                        q_punkt_ko = q_punkt_ev * (1-(1/COP[0]))**(-1)
                        TSinktest = self.t_ko(q_punkt_ko, QuelleSenke)
                
                self.cop_werte.append(COP[0])
                self.ev_wp.append(round(q_punkt_ev))
                self.ko_wp.append(round(q_punkt_ko))
                self.cop_t.append(T)
        self.cop_regression = COP[1]
        self.table_issp = {'Temp': self.cop_t, 'COP':self.cop_werte,'QQuelle':self.ev_wp,'QSenke':self.ko_wp}

        if 'debug' in self.options and self.cop_werte:
            table = {'COP':self.cop_werte[::30],'QQuelle':self.ev_wp[::30],'QSenke':self.ko_wp[::30]}
            print(tabulate(table,headers='keys'))
            print({'COP':self.cop_werte[-1],'QQuelle':self.ev_wp[-1],'QSenke':self.ko_wp[-1]})

    def find_integration(self):
        """
        Select the operating point to report from the walk in table_issp.

        If the very first (hottest) source point already covers the hot utility
        requirement, the heat pump over-delivers straight away and that point is
        the answer. Otherwise the answer is the *last* point walked:
        integrate_heat_pump() refines the step size near the end and iterates
        until the condenser duty converges on the requirement, so the tail of
        the trajectory is the converged solution.

        This used to be written as a `for` loop, but both branches ended in
        `break`, so only index 0 was ever examined. The loop is gone rather than
        repaired: the intermediate points it would have scanned are unconverged
        steps of that refinement, and picking one overshoots the requirement.
        """
        self.integration_point = {'Temp': [], 'COP': [], 'QQuelle': [], 'QSenke': []}
        duties = self.table_issp['QSenke']
        if not duties:
            return

        idx = 0 if duties[0] >= self.gcc_draw['H'][0] else -1

        self.integration_point['Temp'].append(self.table_issp['Temp'][0] + self.step_size_temp)
        self.integration_point['Temp'].append(self.table_issp['Temp'][idx])
        self.integration_point['COP'].append(self.table_issp['COP'][idx])
        self.integration_point['QQuelle'].append(self.table_issp['QQuelle'][idx])
        self.integration_point['QSenke'].append(self.table_issp['QSenke'][idx])


    def integrate_heat_pump_specific(self, hp_type):
        """
        Same as integrate_heat_pump but pinned to one named technology.

        Propagates HeatPumpOutOfRange when the walk reaches an operating point
        the technology is not rated for, so the caller can exclude it with a
        reason instead of reporting a Carnot number under its name.
        """
        self.selected_hp_type = hp_type
        original_COP = self.COP

        def COP_wrapper(T):
            return (self.COP_specific(T, hp_type), hp_type)

        self.COP = COP_wrapper
        try:
            self.integrate_heat_pump()
        finally:
            # del, not reassignment: leaving a bound copy on the instance would
            # shadow the class method for every later call.
            del self.COP


    def solve_for_issp(self):
        self.gcc_draw = self.pyPinch.solve_pinch_for_hpi().grand_composite_curve
        self.GCC = self.delete_temperature_pockets()
        self.integrate_heat_pump()
        self.find_integration()
        return self.integration_point
    
    def HPI(self):
        self.gcc_draw = self.pyPinch.solve_pinch_for_hpi().grand_composite_curve
        Temperaturesdraw = []
        for i in self.pyPinch.pinch_analyse._temperatures:
            Temperaturesdraw.append(i)
        self.delete_temperature_pockets()
        self.gcc_source, self.gcc_sink = self.split_hot_and_cold()
        self.integrate_heat_pump()
        self.find_integration()
        HPIPlot(self.streams_data_file[:-4],self.t_sink_out,self.pyPinch,self.ev_wp,self.ko_wp, 
                self.cop_werte,self.cop_t,self.gcc_draw, Temperaturesdraw, self.cop_regression).draw_cop_ko()
        HPIPlot(self.streams_data_file[:-4],self.t_sink_out,self.pyPinch,self.ev_wp,self.ko_wp, 
                self.cop_werte,self.cop_t,self.gcc_draw, Temperaturesdraw, self.cop_regression).draw_grand_composite_curve()

