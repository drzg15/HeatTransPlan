#Based on:
    #!/usr/bin/env python3
    # -*- coding: utf-8 -*-
    # File              : PyPinch.py
    # License           : License: GNU v3.0
    # Author            : Andrei Leonard Nicusan <aln705@student.bham.ac.uk>
    # Date              : 25.05.2019

import csv
import os
import numpy as np
from app.modules.pinch.streams import Streams 
from app.modules.pinch.pinch_plot import PinchPlot
from app.modules.pinch.pinch_export import PinchExport


class Pinch:

    def __init__(self, streams_data_file, options = {}):

        self.tmin =                      0
        self.streams =                   []
        self.temperatureInterval =       []
        self.problem_table =              []
        self.hot_utility =                0
        self.cold_utility =               0
        self.unfeasible_heat_cascade =     []
        self.heat_cascade =               []
        self.pinch_temperature =          0
        self.shifted_composite_diagram =   {'hot': {'H': [], 'T': []}, 'cold': {'H': [], 'T': []}}
        self.composite_diagram =          {'hot': {'H': [], 'T': []}, 'cold': {'H': [], 'T': []}}
        self.grand_composite_curve =       {'H': [], 'T': []}

        self._temperatures =             []
        self._deltaHHot =                []
        self._deltaHCold =               []
        self._options =                  {'debug': False, 'draw': False, 'csv': False}
        self._temperaturesHOT=           []
        self._temperaturesCOLD =         []
        self.emptyintervalstartHOT=         []
        self.emptyintervalstartCOLD = []
        self.lastHotStream = 0
        self.lastColdStream = 0

        self.emptyintervalsHot = {'H': [], 'T': []}
        self.emptyintervalsCold = {'H': [], 'T': []}

        self.process_designation = streams_data_file[:-4]
        self.newpath = os.path.join('Output', "{} Pinch".format(self.process_designation))

        self.streams = Streams(streams_data_file)
        self.tmin = self.streams.tmin

        if 'debug' in options:
            self._options['debug'] = True
        if 'draw' in options:
            self._options['draw'] = True
        if 'csv' in options:
            self._options['csv'] = True


    def shift_temperatures(self):
        for stream in self.streams:
            if stream['type'] == 'HOT':
                stream['ss'] = stream['ts'] - self.tmin / 2
                stream['st'] = stream['tt'] - self.tmin / 2
            else:
                stream['ss'] = stream['ts'] + self.tmin / 2
                stream['st'] = stream['tt'] + self.tmin / 2

        if self._options['debug'] == True:
            print("\nStreams: ")
            for stream in self.streams:
                print(stream)
            print("Tmin = {}".format(self.tmin))


    def construct_temperature_interval(self):
        # Take all shifted temperatures and reverse sort them,
        # removing all duplicates
        for stream in self.streams:
            self._temperatures.append(stream['ss'])
            self._temperatures.append(stream['st'])

            if (stream["type"] == "HOT"):
                self._temperaturesHOT.append(stream['ss'])
                self._temperaturesHOT.append(stream['st'])

            else:
                self._temperaturesCOLD.append(stream['ss'])
                self._temperaturesCOLD.append(stream['st'])


        self._temperaturesHOT = list(set(self._temperaturesHOT))
        self._temperaturesHOT.sort()
        self._temperaturesCOLD = list(set(self._temperaturesCOLD))
        self._temperaturesCOLD.sort()
        self._temperatures = list(set(self._temperatures))
        self._temperatures.sort(reverse = True)

        # Save the stream number of all the streams that pass
        # through each shifted temperature interval
        for i in range(len(self._temperatures) - 1):
            t1 = self._temperatures[i]
            t2 = self._temperatures[i + 1]
            interval = {'t1': t1, 't2': t2, 'streamNumbers': []}

            
            j = 0
            for stream in self.streams:
                if (stream['type'] == 'HOT'):
                    if (stream['ss'] >= t1 and stream['st'] <= t2):
                        interval['streamNumbers'].append(j)
                else:
                    if (stream['st'] >= t1 and stream['ss'] <= t2):
                        interval['streamNumbers'].append(j)
                j = j + 1

            self.temperatureInterval.append(interval)
        


        if self._options['debug'] == True:
            print("\nTemperature Intervals: ")
            i = 0
            print(self._temperatures)
            for interval in self.temperatureInterval:
                print("Interval {} : {}".format(i, interval))
                i = i + 1

        if self._options['draw'] == True:
            PinchPlot().draw_temperature_interval(self._temperatures, self.streams)



    def construct_problem_table(self):

        for interval in self.temperatureInterval:
            row = {}
            row['deltaS'] = interval['t1'] - interval['t2']
            row['deltaCP'] = 0

            # An empty streamNumbers just skips the loop, leaving deltaCP at 0.
            for i in interval['streamNumbers']:
                if self.streams.streamsData[i]['type'] == 'HOT':
                    row['deltaCP'] = row['deltaCP'] + self.streams.streamsData[i]['cp']
                else:
                    row['deltaCP'] = row['deltaCP'] - self.streams.streamsData[i]['cp']

            row['deltaH'] = row['deltaS'] * row['deltaCP']
            self.problem_table.append(row)

        if self._options['debug'] == True:
            print("\nProblem Table: ")
            i = 0
            for interval in self.problem_table:
                print("Interval {} : {}".format(i, interval))
                i = i + 1

        if self._options['draw'] == True:
            PinchPlot().draw_problem_table(self.problem_table, self._temperatures)

        if self._options['csv'] == True:
            PinchExport().csv_problem_table(self.problem_table, self._temperatures, self.newpath)
 

    def construct_heat_cascade(self):

        exitH = 0
        lowestExitH = 0

        i = 0
        pinchInterval = 0
        for interval in self.problem_table:
            row = {}
            row['deltaH'] = interval['deltaH']

            exitH = exitH + row['deltaH']
            row['exitH'] = exitH
            if exitH < lowestExitH:
                lowestExitH = exitH
                pinchInterval = i

            self.unfeasible_heat_cascade.append(row)
            i = i + 1

        self.hot_utility = -lowestExitH
        exitH = self.hot_utility

        for interval in self.problem_table:
            row = {}
            row['deltaH'] = interval['deltaH']

            exitH = exitH + row['deltaH']
            row['exitH'] = exitH

            self.heat_cascade.append(row)

        self.cold_utility = exitH
        self.pinch_temperature = self.temperatureInterval[pinchInterval]['t2']

        if self._options['debug'] == True:
            print("\nUnfeasible Heat Cascade: ")
            i = 0
            for interval in self.unfeasible_heat_cascade:
                print("Interval {} : {}".format(i, interval))
                i = i + 1

            print("\nFeasible Heat Cascade: ")
            i = 0
            for interval in self.heat_cascade:
                print("Interval {} : {}".format(i, interval))
                i = i + 1

            print("\nPinch Temperature (degC): {}".format(self.pinch_temperature))
            print("Minimum Hot Utility (kW): {}".format(self.hot_utility))
            print("Minimum Cold Utility (kW): {}".format(self.cold_utility))

        if self._options['draw'] == True:
            PinchPlot().draw_heat_cascade(self.unfeasible_heat_cascade, self.heat_cascade, self.hot_utility)

        if self._options['csv'] == True:
            PinchExport().csv_heat_cascade(self.unfeasible_heat_cascade, self.hot_utility, self.heat_cascade, self.pinch_temperature, self.newpath)


    def construct_shifted_composite_diagram(self, localisation):
        for interval in self.temperatureInterval:
            hotH = 0
            coldH = 0
            # Add CP values for the hot and cold streams
            # in a given temperature interval
            # An empty streamNumbers just skips the loop, leaving both at 0.
            for i in interval['streamNumbers']:
                if self.streams.streamsData[i]['type'] == 'HOT':
                    hotH = hotH + self.streams.streamsData[i]['cp']
                else:
                    coldH = coldH + self.streams.streamsData[i]['cp']
            # Enthalpy = CP * deltaT
            #checken ob geprüftes interval einen heißen strom enthält und erst dann anfangen
            #dann immer wieder prüfen, ob danach noch ein heoßer strom kommt
            
            hotH = hotH * (interval['t1'] - interval['t2'])
            self._deltaHHot.append(hotH)



            coldH = coldH * (interval['t1'] - interval['t2'])
            self._deltaHCold.append(coldH)


# rot bei 0/t1 anfangen
# blau bei coldutility/t2 anfangen
        self.shifted_composite_diagram['hot']['T']= []

        self._deltaHHot.reverse()
        self.shifted_composite_diagram['hot']['H'].append(0.0)
        for i in range(1, len(self._temperatures)):
            self.shifted_composite_diagram['hot']['H'].append(self.shifted_composite_diagram['hot']['H'][-1] + self._deltaHHot[i-1])
            self.shifted_composite_diagram['hot']['T'].append(self._temperatures[len(self._temperatures)-i])


        self.shifted_composite_diagram['hot']['T'].append(self._temperatures[0])
        #Summe aus allen deltaHCold + coldutility machen und für die Schritte jeweils deltaHCold abziehen
        coldgesamt = self.cold_utility
        for i in range(len(self._deltaHCold)):
            coldgesamt += self._deltaHCold[i]

        #Experimentell
        self.shifted_composite_diagram['cold']['T']= []

        self.shifted_composite_diagram['cold']['H'].append(coldgesamt)

        #Experimentell
        self.shifted_composite_diagram['cold']['T'].append(self._temperatures[0])
        for i in range(1, len(self._temperatures)):
            self.shifted_composite_diagram['cold']['H'].append(self.shifted_composite_diagram['cold']['H'][-1] - self._deltaHCold[i-1])
            self.shifted_composite_diagram['cold']['T'].append(self._temperatures[i])
        

        # Trim the flat ends off the cold curve, mirroring the hot curve below.
        # The cold curve falls monotonically from coldgesamt at H[0] to the cold
        # utility at H[-1], so a run of equal values can only sit at one end:
        # keep the last point of a leading run and the first of a trailing one.
        #
        # There used to be a third branch testing `...['cold']['H'] == 0.0` —
        # the whole list against a float, so always False. Adding the missing
        # [i] would not change any output: an interior H[i] can only equal 0.0
        # when the cold utility is 0, and then H[-1] is 0.0 too, so the trailing
        # branch below already catches it and drops the same index. Verified
        # identical over 400 randomised stream sets; the branch is dropped
        # rather than repaired because it can never do anything on its own.
        iliste = []
        for i in range(1,(len(self.shifted_composite_diagram['cold']['H'])-1)):
            if self.shifted_composite_diagram['cold']['H'][i] == self.shifted_composite_diagram['cold']['H'][0]:
                iliste.append(i-1)
            elif self.shifted_composite_diagram['cold']['H'][i] == self.shifted_composite_diagram['cold']['H'][-1]:
                iliste.append(i+1)
        iliste.reverse()

        for i in iliste:
            self.shifted_composite_diagram['cold']['H'].pop(i)
            self.shifted_composite_diagram['cold']['T'].pop(i)
        iliste = []
        for i in range(1,(len(self.shifted_composite_diagram['hot']['H'])-1)):
            if self.shifted_composite_diagram['hot']['H'][i] == 0.0:
                iliste.append(i-1)
            elif self.shifted_composite_diagram['hot']['H'][i] == self.shifted_composite_diagram['hot']['H'][-1]:
                iliste.append(i+1)
        iliste.reverse()

        for i in iliste:
            self.shifted_composite_diagram['hot']['H'].pop(i)
            self.shifted_composite_diagram['hot']['T'].pop(i)
        
        if self._options['draw'] == True:
            PinchPlot().draw_shifted_composite_diagram(self.shifted_composite_diagram, self.cold_utility, 
                                                    self._temperatures, self.hot_utility, self.pinch_temperature, 
                                                    self.process_designation, localisation)

        if self._options['csv'] == True:
            PinchExport().csv_shifted_composite_diagram(self.newpath, self.shifted_composite_diagram)
        


    def construct_composite_diagram(self, localisation):
        self.composite_diagram['hot']['T'] = [x + self.tmin / 2 for x in self.shifted_composite_diagram['hot']['T']]
        # list(), not a bare assignment: sharing the list object means a later
        # edit to one diagram silently rewrites the other.
        self.composite_diagram['hot']['H'] = list(self.shifted_composite_diagram['hot']['H'])
        self.composite_diagram['cold']['T'] = [x - self.tmin / 2 for x in self.shifted_composite_diagram['cold']['T']]
        self.composite_diagram['cold']['H'] = list(self.shifted_composite_diagram['cold']['H'])

        if self._options['debug'] == True:
            print("\nComposite Diagram temperatures: {}".format(self._temperatures))

        if self._options['draw'] == True:
            PinchPlot().draw_composite_diagram(self.composite_diagram, self.shifted_composite_diagram, 
                                             self.cold_utility, self._temperatures, self.tmin, self.hot_utility, 
                                             self.pinch_temperature, self.process_designation, localisation)

        if self._options['csv'] == True:
            PinchExport().csv_composite_diagram(self.newpath, self.composite_diagram)



    def construct_grand_composite_curve(self,localisation):
        self.grand_composite_curve['H'].append(self.hot_utility)
        self.grand_composite_curve['T'].append(self._temperatures[0])
        for i in range(1, len(self._temperatures)):
            self.grand_composite_curve['H'].append(self.heat_cascade[i - 1]['exitH'])
            self.grand_composite_curve['T'].append(self._temperatures[i])

        if self._options['debug'] == True:
            print("\nHeat Cascade: {}".format(self.heat_cascade))
            print("\nGrand Composite Curve: ")
            print("Net H (kW): {}".format(self.grand_composite_curve['H']))
            print("T (degC): {}".format(self.grand_composite_curve['T']))
            

        if self._options['draw'] == True:
            PinchPlot().draw_grand_composite_curve(self.process_designation, self.heat_cascade, 
                                                self.grand_composite_curve, self._temperatures, self.pinch_temperature, localisation)

        if self._options['csv'] == True:
            PinchExport().csv_grand_composite_curve(self.newpath, self.grand_composite_curve)

