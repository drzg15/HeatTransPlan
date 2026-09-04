import csv
from app.modules.pinch.pinch import Pinch
from app.modules.pinch.pinch_plot import PinchPlot

class PinchMain():
    def __init__(self, CSV, options = {}):
        self.pinch_analyse = Pinch(CSV, options)
        self._options = {}
       
    def solve_pinch(self, localisation = 'DE'):

        self.pinch_analyse.shift_temperatures()
        self.pinch_analyse.construct_temperature_interval()
        self.pinch_analyse.construct_problem_table()
        self.pinch_analyse.construct_heat_cascade()
        self.pinch_analyse.construct_shifted_composite_diagram(localisation)
        self.pinch_analyse.construct_composite_diagram(localisation)
        self.pinch_analyse.construct_grand_composite_curve(localisation)

        with open("Buffer file for TotalSiteProfile creation.csv", "w", newline="") as csvfile:
            self.newstreamsdata = csv.writer(csvfile)
            self.newstreamsdata.writerow(self.pinch_analyse._temperatures)
            self.newstreamsdata.writerow(self.pinch_analyse.heat_cascade)
            self.newstreamsdata.writerow([self.pinch_analyse.hot_utility])


        if self.pinch_analyse._options['draw'] == True:
            PinchPlot.show_plots()  

    def solve_pinch_for_issp(self, localisation = 'DE'):

        self.pinch_analyse.shift_temperatures()
        self.pinch_analyse.construct_temperature_interval()
        self.pinch_analyse.construct_problem_table()
        self.pinch_analyse.construct_heat_cascade()
        self.pinch_analyse.construct_shifted_composite_diagram(localisation)

        return[self.pinch_analyse.shifted_composite_diagram, self.pinch_analyse]
    
    def solve_pinch_for_hpi(self, localisation = 'DE'):

        self.pinch_analyse.shift_temperatures()
        self.pinch_analyse.construct_temperature_interval()
        self.pinch_analyse.construct_problem_table()
        self.pinch_analyse.construct_heat_cascade()
        self.pinch_analyse.construct_shifted_composite_diagram(localisation)
        self.pinch_analyse.construct_composite_diagram(localisation)
        self.pinch_analyse.construct_grand_composite_curve(localisation)

        return(self.pinch_analyse)

#PinchMain('Example.csv', options={'draw', 'csv'}).solve_pinch()
#PinchMain('Prozess_neu.csv', options={'draw', 'csv'}).solve_pinch()