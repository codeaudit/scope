import debug from 'debug';
import React from 'react';
import classNames from 'classnames';
import { find, get, union, sortBy, groupBy, concat, debounce, findIndex } from 'lodash';

import ShowMore from '../show-more';
import NodeDetailsTableRow from './node-details-table-row';
import { ipToPaddedString } from '../../utils/string-utils';
import { moveElement, insertElement } from '../../utils/array-utils';
import { TABLE_ROW_FOCUS_DEBOUNCE_INTERVAL } from '../../constants/timer';


const log = debug('scope:table');

function isNumber(data) {
  return data.dataType && data.dataType === 'number';
}


function isIP(data) {
  return data.dataType && data.dataType === 'ip';
}


const CW = {
  XS: '32px',
  S: '50px',
  M: '70px',
  L: '120px',
  XL: '140px',
  XXL: '170px',
};


const XS_LABEL = {
  count: '#',
  // TODO: consider changing the name of this field on the BE
  container: '#',
};


const COLUMN_WIDTHS = {
  count: CW.XS,
  container: CW.XS,
  docker_container_created: CW.XXL,
  docker_container_restart_count: CW.M,
  docker_container_state_human: CW.XXL,
  docker_container_uptime: '85px',
  docker_cpu_total_usage: CW.M,
  docker_memory_usage: CW.M,
  open_files_count: CW.M,
  pid: CW.S,
  port: CW.S,
  ppid: CW.S,
  process_cpu_usage_percent: CW.M,
  process_memory_usage_bytes: CW.M,
  threads: CW.M,

  // e.g. details panel > pods
  kubernetes_ip: CW.L,
  kubernetes_state: CW.M,
};


function getDefaultSortedBy(columns, nodes) {
  // default sorter specified by columns
  const defaultSortColumn = find(columns, {defaultSort: true});
  if (defaultSortColumn) {
    return defaultSortColumn.id;
  }
  // otherwise choose first metric
  const firstNodeWithMetrics = find(nodes, n => get(n, ['metrics', 0]));
  if (firstNodeWithMetrics) {
    return get(firstNodeWithMetrics, ['metrics', 0, 'id']);
  }

  return 'label';
}


function maybeToLower(value) {
  if (!value || !value.toLowerCase) {
    return value;
  }
  return value.toLowerCase();
}


function getNodeValue(node, header) {
  const fieldId = header && header.id;
  if (fieldId !== null) {
    let field = union(node.metrics, node.metadata).find(f => f.id === fieldId);

    if (field) {
      if (isIP(header)) {
        // Format the IPs so that they are sorted numerically.
        return ipToPaddedString(field.value);
      } else if (isNumber(header)) {
        return parseFloat(field.value);
      }
      return field.value;
    }

    if (node.parents) {
      field = node.parents.find(f => f.topologyId === fieldId);
      if (field) {
        return field.label;
      }
    }

    if (node[fieldId] !== undefined && node[fieldId] !== null) {
      return node[fieldId];
    }
  }

  return null;
}


function getValueForSortedBy(sortedByHeader) {
  return node => maybeToLower(getNodeValue(node, sortedByHeader));
}


function getMetaDataSorters(nodes) {
  // returns an array of sorters that will take a node
  return get(nodes, [0, 'metadata'], []).map((field, index) => (node) => {
    const nodeMetadataField = node.metadata && node.metadata[index];
    if (nodeMetadataField) {
      if (isNumber(nodeMetadataField)) {
        return parseFloat(nodeMetadataField.value);
      }
      return nodeMetadataField.value;
    }
    return null;
  });
}


function sortNodes(nodes, getValue, sortedDesc) {
  const sortedNodes = sortBy(
    nodes,
    getValue,
    getMetaDataSorters(nodes)
  );
  if (sortedDesc) {
    sortedNodes.reverse();
  }
  return sortedNodes;
}


function getSortedNodes(nodes, sortedByHeader, sortedDesc) {
  const getValue = getValueForSortedBy(sortedByHeader);
  const withAndWithoutValues = groupBy(nodes, (n) => {
    const v = getValue(n);
    return v !== null && v !== undefined ? 'withValues' : 'withoutValues';
  });
  const withValues = sortNodes(withAndWithoutValues.withValues, getValue, sortedDesc);
  const withoutValues = sortNodes(withAndWithoutValues.withoutValues, getValue, sortedDesc);

  return concat(withValues, withoutValues);
}


function getColumnWidth(headers, h) {
  //
  // More beauty hacking, ports and counts can only get so big, free up WS for other longer
  // fields like IPs!
  //
  return COLUMN_WIDTHS[h.id];
}


function getColumnsStyles(headers) {
  return headers.map((h, i) => ({
    width: getColumnWidth(headers, h, i),
    textAlign: h.dataType === 'number' ? 'right' : 'left',
  }));
}


function defaultSortDesc(header) {
  return header && header.dataType === 'number';
}


export default class NodeDetailsTable extends React.Component {

  constructor(props, context) {
    super(props, context);
    this.DEFAULT_LIMIT = 5;
    this.state = {
      limit: props.limit || this.DEFAULT_LIMIT,
      sortedDesc: this.props.sortedDesc,
      sortedBy: this.props.sortedBy
    };
    this.handleLimitClick = this.handleLimitClick.bind(this);
    this.onMouseLeaveRow = this.onMouseLeaveRow.bind(this);
    this.onMouseEnterRow = this.onMouseEnterRow.bind(this);
    // Use debouncing to prevent event flooding when e.g. crossing fast with mouse cursor
    // over the whole table. That would be expensive as each focus causes table to rerender.
    this.debouncedFocusRow = debounce(this.focusRow, TABLE_ROW_FOCUS_DEBOUNCE_INTERVAL);
    this.debouncedUnfocusRow = debounce(this.unfocusRow, TABLE_ROW_FOCUS_DEBOUNCE_INTERVAL);
  }

  handleHeaderClick(ev, headerId, currentSortedBy, currentSortedDesc) {
    ev.preventDefault();
    const header = this.getColumnHeaders().find(h => h.id === headerId);
    const sortedBy = header.id;
    const sortedDesc = header.id === currentSortedBy
      ? !currentSortedDesc : defaultSortDesc(header);
    this.setState({sortedBy, sortedDesc});
    this.props.onSortChange(sortedBy, sortedDesc);
  }

  handleLimitClick() {
    const limit = this.state.limit ? 0 : this.DEFAULT_LIMIT;
    this.setState({limit});
  }

  focusRow(rowIndex, node) {
    this.setState({
      focusedRowIndex: rowIndex,
      focusedNode: node
    });
    log(`Focused row ${rowIndex}`);
  }

  unfocusRow() {
    if (this.state.focusedRowIndex) {
      this.setState({
        focusedRowIndex: null,
        focusedNode: null
      });
      log('Unfocused row');
    }
  }

  onMouseEnterRow(rowIndex, node) {
    this.debouncedUnfocusRow.cancel();
    this.debouncedFocusRow(rowIndex, node);
  }

  onMouseLeaveRow() {
    this.debouncedFocusRow.cancel();
    this.debouncedUnfocusRow();
  }

  getColumnHeaders() {
    const columns = this.props.columns || [];
    return [{id: 'label', label: this.props.label}].concat(columns);
  }

  renderHeaders(sortedBy, sortedDesc) {
    if (!this.props.nodes || this.props.nodes.length === 0) {
      return null;
    }

    const headers = this.getColumnHeaders();
    const colStyles = getColumnsStyles(headers);

    return (
      <tr>
        {headers.map((header, i) => {
          const headerClasses = ['node-details-table-header', 'truncate'];
          const onHeaderClick = (ev) => {
            this.handleHeaderClick(ev, header.id, sortedBy, sortedDesc);
          };
          // sort by first metric by default
          const isSorted = header.id === sortedBy;
          const isSortedDesc = isSorted && sortedDesc;
          const isSortedAsc = isSorted && !isSortedDesc;

          if (isSorted) {
            headerClasses.push('node-details-table-header-sorted');
          }

          const style = colStyles[i];
          const label = (style.width === CW.XS && XS_LABEL[header.id]) ?
            XS_LABEL[header.id] :
            header.label;

          return (
            <td
              className={headerClasses.join(' ')} style={style} onClick={onHeaderClick}
              title={header.label} key={header.id}>
              {isSortedAsc
                && <span className="node-details-table-header-sorter fa fa-caret-up" />}
              {isSortedDesc
                && <span className="node-details-table-header-sorter fa fa-caret-down" />}
              {label}
            </td>
          );
        })}
      </tr>
    );
  }

  render() {
    const { nodeIdKey, columns, topologyId, onClickRow, onMouseEnter, onMouseLeave } = this.props;
    const { focusedRowIndex, focusedNode } = this.state;

    const sortedBy = this.state.sortedBy || getDefaultSortedBy(columns, this.props.nodes);
    const sortedByHeader = this.getColumnHeaders().find(h => h.id === sortedBy);
    const sortedDesc = this.state.sortedDesc !== null ?
      this.state.sortedDesc :
      defaultSortDesc(sortedByHeader);

    let nodes = getSortedNodes(this.props.nodes, sortedByHeader, sortedDesc);
    if (focusedRowIndex && focusedRowIndex < nodes.length) {
      const nodeRowIndex = findIndex(nodes, node => node.id === focusedNode.id);
      if (nodeRowIndex >= 0) {
        // If the focused node still exists in the table, we move it
        // to the hovered row, keeping the rest of the table sorted.
        moveElement(nodes, nodeRowIndex, focusedRowIndex);
      } else {
        // Otherwise we insert the dead focused node there, pretending
        // it's still alive. That enables the users to read off all the
        // info they want and perhaps even open the details panel. Also,
        // only if we do this, we can guarantee that mouse hover will
        // always freeze the table row until we focus out.
        insertElement(nodes, focusedRowIndex, focusedNode);
      }
    }

    const limited = nodes && this.state.limit > 0 && nodes.length > this.state.limit;
    const expanded = this.state.limit === 0;
    const notShown = nodes.length - this.state.limit;
    if (nodes && limited) {
      nodes = nodes.slice(0, this.state.limit);
    }

    const className = classNames('node-details-table-wrapper-wrapper', this.props.className);

    return (
      <div className={className} style={this.props.style}>
        <div className="node-details-table-wrapper">
          <table className="node-details-table">
            <thead>
              {this.renderHeaders(sortedBy, sortedDesc)}
            </thead>
            <tbody
              style={this.props.tbodyStyle}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}>
              {nodes && nodes.map((node, index) => (
                <NodeDetailsTableRow
                  key={node.id}
                  renderIdCell={this.props.renderIdCell}
                  selected={this.props.selectedNodeId === node.id}
                  node={node}
                  nodeIdKey={nodeIdKey}
                  colStyles={getColumnsStyles(this.getColumnHeaders())}
                  columns={columns}
                  onClick={onClickRow}
                  onMouseEnter={() => { this.onMouseEnterRow(index, node); }}
                  onMouseLeave={this.onMouseLeaveRow}
                  topologyId={topologyId} />
              ))}
            </tbody>
          </table>
          <ShowMore
            handleClick={this.handleLimitClick}
            collection={nodes}
            expanded={expanded}
            notShown={notShown} />
        </div>
      </div>
    );
  }
}


NodeDetailsTable.defaultProps = {
  nodeIdKey: 'id',  // key to identify a node in a row (used for topology links)
  onSortChange: () => {},
  sortedDesc: null,
  sortedBy: null,
};
