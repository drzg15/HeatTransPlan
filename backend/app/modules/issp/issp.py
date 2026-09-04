from matplotlib import pyplot as plt
from app.modules.utility.thermodynamic_properties import ThermodynamicProperties as Props

class ISSP():
    def __init__(self, streams_data_file, TS, TProcess, batchtime_seconds, pyPinch, HPI, from_pinch, intermediateCircuit = {}):

        self.process_designation = streams_data_file[:-4]
        self.streams_data_file = streams_data_file
        self.options = {'draw', 'debug'}
        self.from_pinch = bool(from_pinch)
        self.intermediateCircuit = bool(intermediateCircuit)
        self.TS = TS
        self.TProcess = TProcess

        self.integration_point = HPI.solve_for_issp()
        self.Pinch = pyPinch.solve_pinch_for_issp()
        self.CC = self.Pinch[0]
        self.pyPinch = self.Pinch[1]

        self.deltaTmin = self.pyPinch.tmin

        self.t = batchtime_seconds/3600
    
    def cc_in_kwh(self):
        for i in range(len(self.CC['hot']['H'])):
            self.CC['hot']['H'][i] = self.CC['hot']['H'][i]*self.t
        self.CC['hot']['kWh'] = self.CC['hot']['H']
        del self.CC['hot']['H']

        for i in range(len(self.CC['cold']['H'])):
            self.CC['cold']['H'][i] = self.CC['cold']['H'][i]*self.t
        self.CC['cold']['kWh'] = self.CC['cold']['H']
        del self.CC['cold']['H']
    
    def issp_hot_intermediate_gerade(self, kWh, Tempdiff):
        return (self.integration_point['Temp'][-1]-Tempdiff) + ((self.integration_point['Temp'][0]-self.TemperaturKorrektur) - (self.integration_point['Temp'][-1]-Tempdiff))/(self.integration_point['QQuelle'][0]*self.t) * (kWh-self.DifferenzHot)
  
    def draw_issp_hot_intermediate(self):#Verdichter
        if self.from_pinch == True:
            self.TemperaturKorrektur = 1.25 * self.deltaTmin
        else:
            self.TemperaturKorrektur = 0.25 * self.deltaTmin
        deltaTZwischenlreislauf0 = 2/4 * self.deltaTmin
        self.DifferenzHot = self.CC['hot']['kWh'][-1] - self.integration_point['QQuelle'][0]*self.t
        self.cold_utility = self.pyPinch.cold_utility*self.t
        self.hot_utility = self.pyPinch.hot_utility*self.t
        self._temperatures = self.pyPinch._temperatures
        self.pinch_temperature = self.pyPinch.pinch_temperature
        m = 0
        for i in range(len(self.CC['hot']['T'])):
            if self.CC['hot']['T'][i] >= self.integration_point['Temp'][-1]:
                
                try: m = self.CC['hot']['T'][i-1] + (self.CC['hot']['T'][i] - self.CC['hot']['T'][i-1])/(self.CC['hot']['kWh'][i] - self.CC['hot']['kWh'][i-1]) * (self.DifferenzHot-self.CC['hot']['kWh'][i-1])

                except: print('error m') #m = self.CC['hot']['T'][1] + (self.CC['hot']['T'][i+1] - self.CC['hot']['T'][i])/(self.CC['hot']['kWh'][i+1] - self.CC['hot']['kWh'][i]) * (self.integration_point['QQuelle'][0]*self.t - self.CC['hot']['kWh'][i])
                if m != 0:
                    break
        if float(self.DifferenzHot) == 0.0 and float(self.CC['hot']['kWh'][-2]) == 0.0:
            ZwischenkreislaufTemp = self.CC['hot']['T'][-1] - deltaTZwischenlreislauf0
        else:
            ZwischenkreislaufTemp = (self.CC['hot']['T'][-2] - deltaTZwischenlreislauf0) + (self.CC['hot']['T'][-2] - m) / (self.CC['hot']['kWh'][-2] - self.DifferenzHot) * (self.CC['hot']['kWh'][-1] -self.CC['hot']['kWh'][-2]) 
            self.TemperaturKorrektur = (self.CC['hot']['T'][-2] - self.TemperaturKorrektur) + (self.CC['hot']['T'][-2] - m) / (self.CC['hot']['kWh'][-2] - self.DifferenzHot) * (self.CC['hot']['kWh'][-1] -self.CC['hot']['kWh'][-2]) 
        
        self.VolumenWWSpeicher = round(self.integration_point['QQuelle'][0]*self.t * 3600 / (4.18 * (ZwischenkreislaufTemp-(m-deltaTZwischenlreislauf0)))/1000,1) #m^3
        plt.close('all')
        fig = plt.figure(num='{} Verd'.format(self.process_designation))
        if self.intermediateCircuit == True:
            plt.plot(self.CC['hot']['kWh'], self.CC['hot']['T'], 'tab:red')
            plt.plot([self.DifferenzHot,self.integration_point['QQuelle'][0]*self.t+self.DifferenzHot], [self.integration_point['Temp'][-1]-1.25*self.deltaTmin,+self.TemperaturKorrektur], 'tab:blue')
            plt.plot([self.DifferenzHot,self.integration_point['QQuelle'][0]*self.t+self.DifferenzHot], [m-deltaTZwischenlreislauf0,ZwischenkreislaufTemp], 'k')

            #plt.plot(self.CC['hot']['kWh'], self.CC['hot']['T'], 'ro')
            plt.plot([self.DifferenzHot,self.integration_point['QQuelle'][0]*self.t+self.DifferenzHot], [self.integration_point['Temp'][-1]-1.25*self.deltaTmin,self.TemperaturKorrektur], 'bo')
            plt.plot([self.DifferenzHot,self.integration_point['QQuelle'][0]*self.t+self.DifferenzHot],[(m-deltaTZwischenlreislauf0),ZwischenkreislaufTemp],'ko')
        elif self.from_pinch == False: 
            plt.plot([0,self.integration_point['QQuelle'][0]*self.t+self.DifferenzHot], [self._temperatures[-1]+0.5*self.deltaTmin,ZwischenkreislaufTemp-self.deltaTmin], 'tab:red')
            plt.plot([0,self.integration_point['QQuelle'][0]*self.t+self.DifferenzHot], [self._temperatures[-1]+0.25*self.deltaTmin,self._temperatures[-1]+0.25*self.deltaTmin])#,self.TemperaturKorrektur], 'tab:blue')
            plt.plot([0,self.integration_point['QQuelle'][0]*self.t+self.DifferenzHot], [self._temperatures[-1]+0.5*self.deltaTmin,ZwischenkreislaufTemp-self.deltaTmin],linestyle = (0, (5, 10)), color = 'black')

            #plt.plot(self.CC['hot']['kWh'], self.CC['hot']['T'], 'ro')
            plt.plot([0,self.integration_point['QQuelle'][0]*self.t+self.DifferenzHot], [self._temperatures[-1]+0.25*self.deltaTmin,self._temperatures[-1]+0.25*self.deltaTmin], 'bo') #self.TemperaturKorrektur
            plt.plot([0,self.integration_point['QQuelle'][0]*self.t+self.DifferenzHot],[self._temperatures[-1]+0.5*self.deltaTmin,ZwischenkreislaufTemp-self.deltaTmin],'ko')
        elif self.from_pinch == True:
            plt.plot([0,self.integration_point['QQuelle'][0]*self.t+self.DifferenzHot], [m-deltaTZwischenlreislauf0,ZwischenkreislaufTemp], 'tab:red')
            plt.plot([0,self.integration_point['QQuelle'][0]*self.t+self.DifferenzHot], [self._temperatures[-1]+0.25*self.deltaTmin,self._temperatures[-1]+0.25*self.deltaTmin])#,self.TemperaturKorrektur], 'tab:blue')
            plt.plot([0,self.integration_point['QQuelle'][0]*self.t+self.DifferenzHot], [m-deltaTZwischenlreislauf0,ZwischenkreislaufTemp],linestyle = (0, (5, 10)), color = 'black')

            #plt.plot(self.CC['hot']['kWh'], self.CC['hot']['T'], 'ro')
            plt.plot([0,self.integration_point['QQuelle'][0]*self.t+self.DifferenzHot], [self.integration_point['Temp'][-1]-1.25*self.deltaTmin,self.integration_point['Temp'][-1]-1.25*self.deltaTmin], 'bo') #self.TemperaturKorrektur
            plt.plot([0,self.integration_point['QQuelle'][0]*self.t+self.DifferenzHot],[(m-deltaTZwischenlreislauf0),ZwischenkreislaufTemp],'ko')


        plt.grid(True,linewidth=1.5)
        plt.tick_params(axis='both', which='major', labelsize=12)
        plt.title('a) ISSP stratified TES', fontsize=14)
        plt.xlabel('ΔH / Batch in kWh', fontsize=14)
        plt.ylabel('Shifted temperature T in °C', fontsize=14)

    def draw_issp_cold_intermediate(self):
        deltaTZwischenkreislauf = 3/4 * self.deltaTmin
        if self.from_pinch == True:
            Verschiebung = 1.25 * self.deltaTmin
            Verschiebung2 = 1.25 * self.deltaTmin
        else:
            Verschiebung = 0.25 * self.deltaTmin
            Verschiebung2 = 0.25 * self.deltaTmin
        self.Dampfmasse = (self.integration_point['QSenke'][0]*self.t * 3600)/Props.get_latent_heat(self.TS)
            #vStrich1 = 1/925.014712422 #140 °C
        h1_prime = Props.get_h_prime(self.TS)
        h1_double_prime = Props.get_h_double_prime(self.TS)
        v1_prime = Props.get_v_prime(self.TS)
        h2_prime = Props.get_h_prime(self.TProcess)
        h2_double_prime = Props.get_h_double_prime(self.TProcess)

        Füllgrad = 0.9     
        self.VolumenDampfSpeicher = round(self.Dampfmasse/ ((Füllgrad/v1_prime)*((h1_prime-h2_prime)/(0.5*(h1_double_prime+h2_double_prime)-h2_prime))),1)
        #http://berndglueck.de/Waermespeicher

        fig = plt.figure(num='{} Kond'.format(self.process_designation))
        if self.intermediateCircuit == True:
            plt.plot([self.CC['cold']['kWh'][-1],self.integration_point['QSenke'][0]*self.t+self.CC['cold']['kWh'][-1]], [self.CC['cold']['T'][-1]+Verschiebung,self.CC['cold']['T'][0]+Verschiebung], 'tab:red')
            plt.plot(self.CC['cold']['kWh'], self.CC['cold']['T'], 'tab:blue')
            plt.plot([self.CC['cold']['kWh'][-1],self.integration_point['QSenke'][0]*self.t+self.CC['cold']['kWh'][-1]], [self.CC['cold']['T'][-1]+Verschiebung-deltaTZwischenkreislauf,self.CC['cold']['T'][0]+Verschiebung-deltaTZwischenkreislauf], 'k')

            plt.plot([self.CC['cold']['kWh'][-1],self.integration_point['QSenke'][0]*self.t+self.CC['cold']['kWh'][-1]], [self.CC['cold']['T'][-1]+Verschiebung,self.CC['cold']['T'][0]+Verschiebung], 'ro')
            plt.plot(self.CC['cold']['kWh'], self.CC['cold']['T'], 'bo')
            plt.plot([self.CC['cold']['kWh'][-1],self.integration_point['QSenke'][0]*self.t+self.CC['cold']['kWh'][-1]], [self.CC['cold']['T'][-1]+Verschiebung-deltaTZwischenkreislauf,self.CC['cold']['T'][0]+Verschiebung-deltaTZwischenkreislauf], 'ko')
        else:
            plt.plot([0,self.integration_point['QSenke'][0]*self.t], [self.CC['cold']['T'][0]+Verschiebung2,self.CC['cold']['T'][0]+Verschiebung2], 'tab:red')
            plt.plot([0,self.integration_point['QSenke'][0]*self.t], [self.CC['cold']['T'][-1]+Verschiebung-deltaTZwischenkreislauf,self.CC['cold']['T'][0]+Verschiebung-deltaTZwischenkreislauf], 'tab:blue')
            plt.plot([0,self.integration_point['QSenke'][0]*self.t], [self.CC['cold']['T'][-1]+Verschiebung-deltaTZwischenkreislauf,self.CC['cold']['T'][0]+Verschiebung-deltaTZwischenkreislauf],linestyle = (0, (5, 10)), color = 'black')

            plt.plot([0,self.integration_point['QSenke'][0]*self.t], [self.CC['cold']['T'][0]+Verschiebung2,self.CC['cold']['T'][0]+Verschiebung2], 'ro')
            #plt.plot(self.CC['cold']['kWh'], self.CC['cold']['T'], 'bo')
            plt.plot([0,self.integration_point['QSenke'][0]*self.t], [self.CC['cold']['T'][-1]+Verschiebung-deltaTZwischenkreislauf,self.CC['cold']['T'][0]+Verschiebung-deltaTZwischenkreislauf], 'ko')

        plt.grid(True,linewidth=1.5)
        plt.tick_params(axis='both', which='major', labelsize=12)
        plt.title('b) ISSP steam RSA', fontsize=14)
        plt.xlabel('ΔH / Batch in kWh', fontsize=14)
        plt.xlim(right = 2500)
        plt.ylabel('Shifted temperature T in °C', fontsize=14)