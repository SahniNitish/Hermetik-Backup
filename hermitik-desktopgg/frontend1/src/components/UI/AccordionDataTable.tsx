import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

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

interface ProtocolSection {
  protocol: {
    protocol_id: string;
    name: string;
    chain: string;
    daily_apy?: number;
  };
  sections: SubSection[];
  totalNavValue: number;
}

interface AccordionDataTableProps {
  columns: TableColumn[];
  data: ProtocolSection[];
  className?: string;
}

const AccordionDataTable: React.FC<AccordionDataTableProps> = ({
  columns,
  data,
  className = ''
}) => {
  const [expandedProtocols, setExpandedProtocols] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Expand first protocol by default to show users the functionality
  React.useEffect(() => {
    if (data.length > 0 && expandedProtocols.size === 0) {
      setExpandedProtocols(new Set([data[0].protocol.name]));
    }
  }, [data]);

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

  const toggleProtocol = (protocolName: string) => {
    const newExpanded = new Set(expandedProtocols);
    if (newExpanded.has(protocolName)) {
      newExpanded.delete(protocolName);
      // Also collapse all sections within this protocol
      const sectionsToRemove = Array.from(expandedSections).filter(id => 
        id.startsWith(`${protocolName}-`)
      );
      sectionsToRemove.forEach(id => expandedSections.delete(id));
      setExpandedSections(new Set(expandedSections));
    } else {
      newExpanded.add(protocolName);
    }
    setExpandedProtocols(newExpanded);
  };

  const toggleSection = (protocolName: string, sectionTitle: string) => {
    const sectionId = `${protocolName}-${sectionTitle}`;
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const isProtocolExpanded = (protocolName: string) => expandedProtocols.has(protocolName);
  const isSectionExpanded = (protocolName: string, sectionTitle: string) => 
    expandedSections.has(`${protocolName}-${sectionTitle}`);

  return (
    <div className={`bg-gray-900 rounded-lg overflow-hidden border border-gray-700 shadow-lg ${className}`}>
      <div className="overflow-x-auto min-w-full">
        <table className="w-full border-collapse min-w-max">
          <tbody>
            {data.map((item, protocolIndex) => (
              <React.Fragment key={item.protocol.name}>
                {/* Protocol Header Row */}
                <tr 
                  className="bg-gray-800 border-b border-gray-600 hover:bg-gray-700/50 cursor-pointer transition-colors"
                  onClick={() => toggleProtocol(item.protocol.name)}
                >
                  <td className="px-4 py-4 flex items-center space-x-2">
                    {isProtocolExpanded(item.protocol.name) ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-white font-semibold">
                      {item.protocol.name}
                      {item.protocol.daily_apy && ` - ${item.protocol.daily_apy.toFixed(2)}% APY`}
                    </span>
                  </td>
                  <td colSpan={columns.length - 1} className="px-4 py-4 text-right">
                    <span className="text-gray-400 text-sm">Protocol NAV: </span>
                    <span className="text-white font-bold">
                      ${item.totalNavValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                </tr>

                {/* Protocol Content (shown when expanded) */}
                {isProtocolExpanded(item.protocol.name) && (
                  <>
                    {item.sections.map((section, sectionIndex) => (
                      <React.Fragment key={`${item.protocol.name}-${section.title}`}>
                        {/* Section Header Row */}
                        <tr 
                          className="bg-gray-700 border-b border-gray-600 hover:bg-gray-600/50 cursor-pointer transition-colors"
                          onClick={() => toggleSection(item.protocol.name, section.title)}
                        >
                          <td className="px-8 py-3 flex items-center space-x-2">
                            {isSectionExpanded(item.protocol.name, section.title) ? (
                              <ChevronDown className="w-3 h-3 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-gray-500" />
                            )}
                            <span className="text-gray-200 font-medium">{section.title}</span>
                          </td>
                          <td colSpan={columns.length - 1} className="px-4 py-3 text-right">
                            <span className="text-gray-500 text-sm">{section.title} NAV: </span>
                            <span className="text-gray-200 font-semibold">{section.navValue}</span>
                          </td>
                        </tr>

                        {/* Section Content (shown when expanded) */}
                        {isSectionExpanded(item.protocol.name, section.title) && (
                          <>
                            {/* Column Headers for this section */}
                            <tr className="bg-gray-800 border-b border-gray-600">
                              {columns.map((column, colIndex) => (
                                <th
                                  key={column.key}
                                  className={`px-12 py-2 text-xs font-bold text-gray-300 uppercase tracking-wider border-r border-gray-600 ${
                                    colIndex === columns.length - 1 ? 'border-r-0' : ''
                                  } ${getAlignmentClass(column.align || 'left')} ${column.className || ''}`}
                                >
                                  {column.label}
                                </th>
                              ))}
                            </tr>

                            {/* Data Rows */}
                            {section.data.map((row, rowIndex) => (
                              <tr
                                key={rowIndex}
                                className={`border-b border-gray-700 hover:bg-gray-800/30 transition-colors ${
                                  row.isReward 
                                    ? 'bg-yellow-900/20 border-yellow-600/30' 
                                    : rowIndex % 2 === 0 
                                      ? 'bg-gray-900' 
                                      : 'bg-gray-800/20'
                                }`}
                              >
                                {columns.map((column, colIndex) => (
                                  <td
                                    key={column.key}
                                    className={`px-12 py-3 whitespace-nowrap text-sm border-r border-gray-700 ${
                                      colIndex === columns.length - 1 ? 'border-r-0' : ''
                                    } ${getAlignmentClass(column.align || 'left')}`}
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
                          </>
                        )}
                      </React.Fragment>
                    ))}
                  </>
                )}

                {/* Add spacing between protocols */}
                {protocolIndex < data.length - 1 && (
                  <tr>
                    <td colSpan={columns.length} className="py-2 bg-gray-900"></td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AccordionDataTable;