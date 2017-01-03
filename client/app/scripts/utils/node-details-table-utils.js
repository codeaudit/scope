import { NODE_DETAILS_TABLE_COLUMN_WIDTHS } from '../constants/styles';

export function isGenericTable(table) {
  return table.type === 'multicolumn-table';
}

export function isPropertyList(table) {
  return table.type === 'property-list';
}

export function isNumber(data) {
  return data.dataType && data.dataType === 'number';
}

export function isIP(data) {
  return data.dataType && data.dataType === 'ip';
}

export function defaultSortDesc(header) {
  return header && isNumber(header);
}

export function getColumnsStyles(headers) {
  return headers.map(header => ({
    // More beauty hacking, ports and counts can only get
    // so big, free up WS for other longer fields like IPs!
    // TODO: Replace 'maxWidth' and 'minWidth' with 'width'
    maxWidth: NODE_DETAILS_TABLE_COLUMN_WIDTHS[header.id],
    minWidth: NODE_DETAILS_TABLE_COLUMN_WIDTHS[header.id],
    textAlign: isNumber(header) ? 'right' : 'left'
  }));
}
