import React from 'react';

interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

interface TableRow {
  [key: string]: any;
}

interface SubSection {
  title: string;
  data: TableRow[];
  navValue: string;
}

interface HierarchicalDataTableProps {
  columns: TableColumn[];
  title?: string;
  totalLabel?: string;
  totalValue?: string;
  sections: SubSection[];
  className?: string;
}

const HierarchicalDataTable: React.FC<HierarchicalDataTableProps> = ({
  columns,
  title,
  totalLabel,
  totalValue,
  sections,
  className = ''
}) => {
  const getAlignmentClass = (align: string) => {
    switch (align) {
      case 'center':
        return 'text-center';
      case 'right':
        return 'text-right';
      default:
        return 'text-left';
    }
  };

  return (
    <div className={`bg-gray-900 rounded-lg overflow-hidden border border-gray-700 shadow-lg ${className}`}>
      {/* Main Table Header */}
      {title && (
        <div className="bg-gray-800 px-6 py-4 border-b-2 border-gray-600">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {totalValue && (
              <div className="text-right">
                <span className="text-gray-400 text-sm">{totalLabel || 'Total'}: </span>
                <span className="text-white font-bold text-lg">{totalValue}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto min-w-full">
        <table className="w-full border-collapse min-w-max">
          {sections.map((section, sectionIndex) => (
            <React.Fragment key={sectionIndex}>
              {/* Section Header */}
              <thead>
                <tr className="bg-gray-700 border-b border-gray-600">
                  <td colSpan={columns.length - 1} className="px-4 py-3 text-sm font-bold text-gray-200">
                    {section.title}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-white">
                    {section.navValue}
                  </td>
                </tr>
                
                {/* Column Headers */}
                <tr className="bg-gray-800 border-b border-gray-600">
                  {columns.map((column, index) => (
                    <th
                      key={column.key}
                      className={`px-3 md:px-4 py-2 text-xs font-bold text-gray-300 uppercase tracking-wider border-r border-gray-600 ${
                        index === columns.length - 1 ? 'border-r-0' : ''
                      } ${getAlignmentClass(column.align || 'left')} ${column.className || ''} min-w-0`}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Section Data */}
              <tbody className="bg-gray-900">
                {section.data.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={`border-b border-gray-700 hover:bg-gray-800/50 transition-colors ${
                      row.isReward 
                        ? 'bg-yellow-900/20 border-yellow-600/30' 
                        : rowIndex % 2 === 0 
                          ? 'bg-gray-900' 
                          : 'bg-gray-800/30'
                    }`}
                  >
                    {columns.map((column, colIndex) => (
                      <td
                        key={column.key}
                        className={`px-3 md:px-4 py-3 whitespace-nowrap text-sm border-r border-gray-700 ${
                          colIndex === columns.length - 1 ? 'border-r-0' : ''
                        } ${getAlignmentClass(column.align || 'left')} min-w-0`}
                      >
                        {row.isReward ? (
                          <span className="flex items-center">
                            {column.key === 'ticker' && (
                              <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                            )}
                            <span className="text-yellow-300 font-medium">
                              {row[column.key]}
                            </span>
                          </span>
                        ) : (
                          <span className="text-white">{row[column.key]}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>

              {/* Add spacing between sections */}
              {sectionIndex < sections.length - 1 && (
                <tbody>
                  <tr>
                    <td colSpan={columns.length} className="py-2 bg-gray-900"></td>
                  </tr>
                </tbody>
              )}
            </React.Fragment>
          ))}
        </table>
      </div>
    </div>
  );
};

export default HierarchicalDataTable;