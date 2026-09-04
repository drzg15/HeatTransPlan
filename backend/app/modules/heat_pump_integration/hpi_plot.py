from matplotlib import pyplot as plt

class HPIPlot():
    def __init__(self, process_designation, t_sink_out, pyPinch, ev_wp, ko_wp, COPWerte, COPT, gcc_draw, _temperatures, cop_regression):
        self.process_designation = process_designation
        self.grand_composite_curve = gcc_draw
        self.ko_wp = ko_wp
        self.ev_wp = ev_wp
        self.COPWerte = COPWerte
        self.cop_t = COPT
        self.t_sink_out = t_sink_out
        self.pyPinch = pyPinch
        self._temperatures = _temperatures
        self.cop_regression = cop_regression
    def draw_cop_ko(self):
        self.x = []
        self.y = []
        fig1 = plt.figure()
        for i in self.ko_wp[::3]:
            self.x.append(i)
        for i in self.COPWerte[::3]:
            self.y.append(i)
        plt.plot(self.x,self.y)
        plt.grid(True)
        plt.title('COP gegen Qpunkt Ko')#plt.title('Grand Composite Curve')
        plt.xlabel('Qpunkt Ko [kW]')#plt.xlabel('Net Enthalpy Change ∆H (kW)')
        plt.ylabel('COP [-]')#plt.ylabel('Shifted Temperature S (degC)')
    
    def draw_grand_composite_curve(self):
        grand_composite_curve = self.grand_composite_curve
        Tempplus = 0
        self.heat_cascade = self.pyPinch.heat_cascade
        plt.close('all')
        fig = plt.figure()
        if self.heat_cascade[0]['deltaH'] > 0:  
            plt.plot([grand_composite_curve['H'][0],grand_composite_curve['H'][1]], [self.grand_composite_curve['T'][0],self.grand_composite_curve['T'][1]], 'tab:red')
            plt.plot([grand_composite_curve['H'][0],grand_composite_curve['H'][1]], [self.grand_composite_curve['T'][0],self.grand_composite_curve['T'][1]], 'ro')
        elif self.heat_cascade[0]['deltaH'] < 0:
            plt.plot([grand_composite_curve['H'][0],grand_composite_curve['H'][1]], [self.grand_composite_curve['T'][0],self.grand_composite_curve['T'][1]], 'tab:blue')
            plt.plot([grand_composite_curve['H'][0],grand_composite_curve['H'][1]], [grand_composite_curve['T'][0],grand_composite_curve['T'][1]], 'bo')

        for i in range(1, len(self._temperatures)-1):
            if self.heat_cascade[i]['deltaH'] > 0:
                plt.plot([grand_composite_curve['H'][i],grand_composite_curve['H'][i+1]], [grand_composite_curve['T'][i],grand_composite_curve['T'][i+1]], 'tab:red')
                plt.plot([grand_composite_curve['H'][i],grand_composite_curve['H'][i+1]], [grand_composite_curve['T'][i],grand_composite_curve['T'][i+1]], 'ro')
            elif self.heat_cascade[i]['deltaH'] < 0:
                plt.plot([grand_composite_curve['H'][i],grand_composite_curve['H'][i+1]], [grand_composite_curve['T'][i],grand_composite_curve['T'][i+1]], 'tab:blue')
                plt.plot([grand_composite_curve['H'][i],grand_composite_curve['H'][i+1]], [grand_composite_curve['T'][i],grand_composite_curve['T'][i+1]], 'bo')
            elif self.heat_cascade[i]['deltaH'] == 0 and grand_composite_curve['H'][i]!=0:
                plt.plot([grand_composite_curve['H'][i],grand_composite_curve['H'][i+1]], [grand_composite_curve['T'][i],grand_composite_curve['T'][i+1]], 'tab:blue')
                plt.plot([grand_composite_curve['H'][i],grand_composite_curve['H'][i+1]], [grand_composite_curve['T'][i],grand_composite_curve['T'][i+1]], 'bo')

        plt.plot(self.ev_wp[-1],self.cop_t[-1],'g^')
        plt.plot(self.ko_wp[-1],self.t_sink_out,'g^')
        plt.text(0.94*self.ko_wp[-1],0.93*self.t_sink_out,round(self.COPWerte[-1],2))
        plt.grid(True)
        name = self.process_designation
        plt.suptitle('Großverbundkurve {} °C ({})'.format(round(self.t_sink_out,1),name))#plt.title('Grand Composite Curve')
        plt.title(self.cop_regression)
        plt.xlabel('Nettoenthalpiestromänderung ∆H in kW')#plt.xlabel('Net Enthalpy Change ∆H (kW)')
        plt.ylabel('Verschobene Temperatur in °C')#plt.ylabel('Shifted Temperature S (degC)')
