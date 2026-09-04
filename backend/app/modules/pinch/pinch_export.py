import os
import csv

class PinchExport:
    def __init__(self):
         pass
    def csv_problem_table(self, problem_table, _temperatures, newpath):
        colLabels = ['$Interval: S_i - S_{i+1}$', '$\\Delta T (\\degree C)$', '$\\Delta CP (kW / \\degree C)$', '$\\Delta H (kW)$', '']
        cellText = []

        i = 1
        for interval in problem_table:
            cellRow = []
            cellRow.extend(['{}: {} - {}'.format(i, _temperatures[i - 1], _temperatures[i]),
                interval['deltaS'], interval['deltaCP'], interval['deltaH']])

            if interval['deltaH'] > 0:
                cellRow.append('Surplus')
            elif interval['deltaH'] == 0:
                cellRow.append('-')
            else:
                cellRow.append('Deficit')
            cellText.append(cellRow)
            i = i + 1


        if not os.path.exists(newpath):
            os.makedirs(newpath)
        fileName = 'ProblemTable.csv'

        path = os.path.join(newpath, fileName)
        with open(path, 'w', newline='') as f:
            writer = csv.writer(f, delimiter=',')
            writer.writerow(['Interval: S1 - S2', 'delta T (degC)', 'delta CP (kW / degC)', 'delta H (kW)', ''])
            for rowText in cellText:
                writer.writerow(rowText)

    def csv_heat_cascade(self, unfeasible_heat_cascade, hot_utility, heat_cascade, pinch_temperature, newpath):
        cellText = [['Unfeasible Heat Cascade: ']]
        cellText.append(['', '', 'Hot Utility: 0 kW'])
        cellText.append(['Interval', 'Delta H (kW)', 'Exit H (total kW)'])

        i = 1
        for interval in unfeasible_heat_cascade:
            cellText.append([str(i), interval['deltaH'], interval['exitH']])
            i = i + 1

        cellText.append(['', '', 'Cold Utility: {} kW'.format(unfeasible_heat_cascade[-1]['exitH'])])
        cellText.append([''])

        cellText.append(['Feasible Heat Cascade: '])
        cellText.append(['', '', 'Hot Utility: {} kW'.format(hot_utility)])
        cellText.append(['Interval', 'Delta H (kW)', 'Exit H (total kW)'])

        i = 1
        for interval in heat_cascade:
            cellText.append([str(i), interval['deltaH'], interval['exitH']])
            i = i + 1

        cellText.append(['', '', 'Cold Utility: {} kW'.format(heat_cascade[-1]['exitH'])])
        cellText.append(['','', 'Pinch Temperature: {} degC'.format(pinch_temperature)])

        if not os.path.exists(newpath):
            os.makedirs(newpath)
        fileName = 'HeatCascade.csv'

        path = os.path.join(newpath, fileName)

        with open(path, 'w', newline='') as f:
            writer = csv.writer(f, delimiter=',')
            for rowText in cellText:
                writer.writerow(rowText)


    def csv_shifted_composite_diagram(self, newpath, shifted_composite_diagram):
        if not os.path.exists(newpath):
            os.makedirs(newpath)
        fileName = 'ShiftedCompositeDiagram.csv'

        path = os.path.join(newpath, fileName)
        
        with open(path, 'w', newline='') as f:
            writer = csv.writer(f, delimiter=',')
            writer.writerow(['Hot H', 'Hot T'])
            for i in range(0, len(shifted_composite_diagram['hot']['H'])):
                writer.writerow([shifted_composite_diagram['hot']['H'][i],
                    shifted_composite_diagram['hot']['T'][i]])

            writer.writerow([''])
            writer.writerow(['Cold H', 'Cold T'])
            for i in range(0, len(shifted_composite_diagram['cold']['H'])):
                writer.writerow([shifted_composite_diagram['cold']['H'][i],
                    shifted_composite_diagram['cold']['T'][i]])


    def csv_composite_diagram(self, newpath, composite_diagram):
        if not os.path.exists(newpath):
            os.makedirs(newpath)
        fileName = 'CompositeDiagram.csv'

        path = os.path.join(newpath, fileName)
        with open(path, 'w', newline='') as f:
            writer = csv.writer(f, delimiter=',')
            writer.writerow(['Hot H', 'Hot T'])
            for i in range(0, len(composite_diagram['hot']['H'])):
                writer.writerow([composite_diagram['hot']['H'][i],
                    composite_diagram['hot']['T'][i]])

            writer.writerow([''])
            writer.writerow(['Cold H', 'Cold T'])
            for i in range(0, len(composite_diagram['cold']['H'])):
                writer.writerow([composite_diagram['cold']['H'][i],
                    composite_diagram['cold']['T'][i]])



    def csv_grand_composite_curve(self, newpath, grand_composite_curve):
        if not os.path.exists(newpath):
            os.makedirs(newpath)
        fileName = 'GrandCompositeCurve.csv'

        path = os.path.join(newpath, fileName)
        with open(path, 'w', newline='') as f:
            writer = csv.writer(f, delimiter=',')
            writer.writerow(['Net H (kW)', 'T(degC)'])
            for i in range(0, len(grand_composite_curve['H'])):
                writer.writerow([grand_composite_curve['H'][i],
                    grand_composite_curve['T'][i]])

