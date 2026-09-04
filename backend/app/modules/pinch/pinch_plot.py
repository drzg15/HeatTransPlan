import matplotlib.pyplot as plt 

class PinchPlot:

    def draw_temperature_interval(self, _temperatures, streams):
        fig, ax = plt.subplots()

        plt.title('Shifted Temperature Interval Diagram')
        plt.ylabel('Shifted Temperature S (degC)')
        ax.set_xticklabels([])

        xOffset = 50

        for temperature in _temperatures:
            plt.plot([0, xOffset * (streams.numberOf + 1)], [temperature, temperature], ':k', alpha=0.8)

        arrow_width = streams.numberOf * 0.05
        head_width = arrow_width * 15
        head_length = _temperatures[0] * 0.02
        i = 1
        for stream in streams:
            if stream['type'] == 'HOT':
                plt.text(xOffset, stream['ss'], str(i), bbox=dict(boxstyle='round', alpha=1, fc='tab:red', ec="k"))
                plt.arrow(xOffset, stream['ss'], 0, stream['st'] - stream['ss'], color='tab:red', ec='k', alpha=1,
                        length_includes_head=True, width=arrow_width, head_width=head_width, head_length=head_length)
            else:
                plt.text(xOffset, stream['ss'], str(i), bbox=dict(boxstyle='round', alpha=1, fc='tab:blue', ec="k"))
                plt.arrow(xOffset, stream['ss'], 0, stream['st'] - stream['ss'], color='tab:blue', ec='k', alpha=1,
                        length_includes_head=True, width=arrow_width, head_width=head_width, head_length=head_length)
            xOffset = xOffset + 50
            i = i + 1

    def draw_problem_table(self, problem_table, _temperatures):
        fig, ax = plt.subplots(figsize=(6, 6))
        ax.axis('tight')
        ax.axis('off')
        ax.set_title('Problem Table')

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

        table = ax.table(cellText=cellText, colLabels=colLabels, loc='center')
        table.auto_set_column_width([0, 1, 2, 3, 4])
        table.scale(1.3, 1.3)


    def draw_heat_cascade(self, unfeasible_heat_cascade, heat_cascade, hot_utility):
        fig, axs = plt.subplots(1, 2, figsize=(10, 6))
        axs[0].axis('auto')
        axs[0].axis('off')
        axs[1].axis('auto')
        axs[1].axis('off')

        axs[0].set_title('Unfeasible Heat Cascade')
        axs[1].set_title('Feasible Heat Cascade')

        cellText = []
        cellText.append(['', '', 'Hot Utility: 0'])
        cellText.append(['Interval', '$\\Delta H (kW)$', 'Exit H (total kW)'])

        i = 1
        for interval in unfeasible_heat_cascade:
            cellText.append([str(i), interval['deltaH'], interval['exitH']])
            i = i + 1

        cellText.append(['', '', 'Cold Utility: {}'.format(unfeasible_heat_cascade[-1]['exitH'])])
        table = axs[0].table(cellText=cellText, loc='center')
        table.auto_set_column_width([0, 1, 2])
        table.scale(1.3, 1.3)

        cellText = []
        cellText.append(['', '', 'Hot Utility: {}'.format(hot_utility)])
        cellText.append(['Interval', '$\\Delta H (kW)$', 'Exit H (total kW)'])

        i = 1
        for interval in heat_cascade:
            cellText.append([str(i), interval['deltaH'], interval['exitH']])
            i = i + 1

        cellText.append(['', '', 'Cold Utility: {}'.format(heat_cascade[-1]['exitH'])])
        table = axs[1].table(cellText=cellText, loc='center')
        table.auto_set_column_width([0, 1, 2])
        table.scale(1.3, 1.3)


    def draw_shifted_composite_diagram(self, shifted_composite_diagram, cold_utility, _temperatures, hot_utility, pinch_temperature, process_designation, localisation):
        fig = plt.figure()
        plt.plot(shifted_composite_diagram['hot']['H'], shifted_composite_diagram['hot']['T'], 'tab:red')
        plt.plot(shifted_composite_diagram['cold']['H'], shifted_composite_diagram['cold']['T'], 'tab:blue')

        plt.plot(shifted_composite_diagram['hot']['H'], shifted_composite_diagram['hot']['T'], 'ro')
        plt.plot(shifted_composite_diagram['cold']['H'], shifted_composite_diagram['cold']['T'], 'bo')

        maxColdH = max(shifted_composite_diagram['cold']['H'])

        try:
            pinchIndex = shifted_composite_diagram['cold']['T'].index(pinch_temperature)
            pinchH = shifted_composite_diagram['cold']['H'][pinchIndex]
            plt.plot([pinchH, pinchH], [_temperatures[0], _temperatures[-1]], ':')
        except ValueError:
            pass

        a = plt.fill_between([cold_utility, shifted_composite_diagram['cold']['H'][0]-hot_utility], [shifted_composite_diagram['cold']['T'][0]])
        a.set_hatch('\\')
        a.set_facecolor('w')
        plt.grid(True)
        if localisation == 'DE':
            plt.title('Verschobene Verbundkurven ({})'.format(process_designation))#plt.title('Shifted Temperature-Enthalpy Composite Diagram')
            plt.xlabel('Enthalpiestrom H in kW')
            plt.ylabel('Verschobene Temperatur in °C')
        elif localisation == 'EN':
            plt.title('Shifted Composite Diagram')
            plt.xlabel('Enthalpy H in kW')
            plt.ylabel('Shifted Temperature T in °C')

    def draw_composite_diagram(self, composite_diagram, shifted_composite_diagram, cold_utility, 
                             _temperatures, tmin, hot_utility, pinch_temperature, process_designation, localisation):
        fig = plt.figure()
        plt.plot(composite_diagram['hot']['H'], composite_diagram['hot']['T'], 'tab:red')
        plt.plot(composite_diagram['cold']['H'], composite_diagram['cold']['T'], 'tab:blue')

        plt.plot(composite_diagram['hot']['H'], composite_diagram['hot']['T'], 'ro')
        plt.plot(composite_diagram['cold']['H'], composite_diagram['cold']['T'], 'bo')

        maxColdH = max(composite_diagram['cold']['H'])

        try:
            pinchIndex = shifted_composite_diagram['cold']['T'].index(pinch_temperature)
            pinchH = shifted_composite_diagram['cold']['H'][pinchIndex]
            plt.plot([pinchH, pinchH], [_temperatures[0], _temperatures[-1]], ':')
        except ValueError:
            pass

        plt.grid(True)
        if localisation == 'DE':
            plt.title('Verbundkurven ({})'.format(process_designation))#plt.title('Shifted Temperature-Enthalpy Composite Diagram')
            plt.xlabel('Enthalpiestrom H in kW')
            plt.ylabel('Temperatur in °C')
        elif localisation == 'EN':
            plt.title('Composite Diagram ({})'.format(process_designation))
            plt.xlabel('Enthalpy H in kW')
            plt.ylabel('Temperature T in °C')


    def draw_grand_composite_curve(self, process_designation, heat_cascade, grand_composite_curve, _temperatures, pinch_temperature, localisation):
        fig = plt.figure(num='{}'.format(process_designation))
        if heat_cascade[0]['deltaH'] > 0:  
            plt.plot([grand_composite_curve['H'][0],grand_composite_curve['H'][1]], [grand_composite_curve['T'][0],grand_composite_curve['T'][1]], 'tab:red')
            plt.plot([grand_composite_curve['H'][0],grand_composite_curve['H'][1]], [grand_composite_curve['T'][0],grand_composite_curve['T'][1]], 'ro')
        elif heat_cascade[0]['deltaH'] < 0:
            plt.plot([grand_composite_curve['H'][0],grand_composite_curve['H'][1]], [grand_composite_curve['T'][0],grand_composite_curve['T'][1]], 'tab:blue')
            plt.plot([grand_composite_curve['H'][0],grand_composite_curve['H'][1]], [grand_composite_curve['T'][0],grand_composite_curve['T'][1]], 'bo')

        for i in range(1, len(_temperatures)-1):
            if heat_cascade[i]['deltaH'] > 0:
                plt.plot([grand_composite_curve['H'][i],grand_composite_curve['H'][i+1]], [grand_composite_curve['T'][i],grand_composite_curve['T'][i+1]], 'tab:red')
                plt.plot([grand_composite_curve['H'][i],grand_composite_curve['H'][i+1]], [grand_composite_curve['T'][i],grand_composite_curve['T'][i+1]], 'ro')
            elif heat_cascade[i]['deltaH'] < 0:
                plt.plot([grand_composite_curve['H'][i],grand_composite_curve['H'][i+1]], [grand_composite_curve['T'][i],grand_composite_curve['T'][i+1]], 'tab:blue')
                plt.plot([grand_composite_curve['H'][i],grand_composite_curve['H'][i+1]], [grand_composite_curve['T'][i],grand_composite_curve['T'][i+1]], 'bo')
            elif heat_cascade[i]['deltaH'] == 0 and grand_composite_curve['H'][i]!=0:
                plt.plot([grand_composite_curve['H'][i],grand_composite_curve['H'][i+1]], [grand_composite_curve['T'][i],grand_composite_curve['T'][i+1]], 'tab:blue')
                plt.plot([grand_composite_curve['H'][i],grand_composite_curve['H'][i+1]], [grand_composite_curve['T'][i],grand_composite_curve['T'][i+1]], 'bo')

        plt.plot([0, grand_composite_curve['H'][-1]], [pinch_temperature, pinch_temperature], ':')

        plt.grid(True)
        if localisation == 'DE':
            plt.title('Großverbundkurve ({})'.format(process_designation))
            plt.xlabel('Nettoenthalpiestromänderung ∆H [kW]')
            plt.ylabel('Verschobene Temperatur [°C]')
        elif localisation == 'EN':
            plt.title('Grand Composite Diagram ({})'.format(process_designation))
            plt.xlabel('Net Enthalpy Change ∆H in kW')
            plt.ylabel('Shifted Temperature T in °C')

    def show_plots():
        plt.show()
