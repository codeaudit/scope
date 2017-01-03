import React from 'react';
import { Map as makeMap } from 'immutable';
import { sortBy } from 'lodash';

import { isNumber, getColumnsStyles } from '../../utils/node-details-table-utils';
import NodeDetailsTableHeaders from './node-details-table-headers';
import MatchedText from '../matched-text';
import ShowMore from '../show-more';


function sortedRows(rows, columns, sortedBy, sortedDesc) {
  const column = columns.find(c => c.id === sortedBy);
  const orderedRows = sortBy(rows, row => row.id);
  const sorted = sortBy(orderedRows, (row) => {
    let value = row.entries[sortedBy];
    if (isNumber(column)) {
      value = parseFloat(value);
    }
    return value;
  });
  if (sortedDesc) {
    sorted.reverse();
  }
  return sorted;
}

export default class NodeDetailsGenericTable extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.DEFAULT_LIMIT = 5;
    this.state = {
      limit: this.DEFAULT_LIMIT,
      sortedBy: props.columns[0].id,
      sortedDesc: true
    };
    this.handleLimitClick = this.handleLimitClick.bind(this);
    this.updateSorted = this.updateSorted.bind(this);
  }

  updateSorted(sortedBy, sortedDesc) {
    this.setState({ sortedBy, sortedDesc });
  }

  handleLimitClick() {
    const limit = this.state.limit ? 0 : this.DEFAULT_LIMIT;
    this.setState({limit});
  }

  render() {
    const { sortedBy, sortedDesc } = this.state;
    const { columns, matches = makeMap() } = this.props;
    let rows = this.props.rows;
    let notShown = 0;
    const limited = rows && this.state.limit > 0 && rows.length > this.state.limit;
    const expanded = this.state.limit === 0;
    if (rows && limited) {
      const hasNotShownMatch = rows.filter((row, index) => index >= this.state.limit
        && matches.has(row.id)).length > 0;
      if (!hasNotShownMatch) {
        notShown = rows.length - this.DEFAULT_LIMIT;
        rows = rows.slice(0, this.state.limit);
      }
    }

    const styles = getColumnsStyles(columns);
    return (
      <div className="node-details-generic-table">
        <table>
          <thead>
            <NodeDetailsTableHeaders
              headers={columns}
              sortedBy={sortedBy}
              sortedDesc={sortedDesc}
              onClick={this.updateSorted}
            />
          </thead>
          <tbody>
            {sortedRows(rows, columns, sortedBy, sortedDesc).map(row => (
              <tr className="node-details-generic-table-row" key={row.id}>
                {columns.map((column, index) => {
                  const value = row.entries[column.id];
                  const match = matches.get(column.id + row.id);
                  return (
                    <td
                      className="node-details-generic-table-field-value truncate"
                      title={value} key={column.id} style={styles[index]}>
                      <MatchedText text={value} match={match} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <ShowMore
          handleClick={this.handleLimitClick} collection={this.props.rows}
          expanded={expanded} notShown={notShown}
        />
      </div>
    );
  }
}
