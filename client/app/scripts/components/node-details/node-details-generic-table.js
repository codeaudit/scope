import React from 'react';
import { Map as makeMap } from 'immutable';

import MatchedText from '../matched-text';
import ShowMore from '../show-more';

export default class NodeDetailsGenericTable extends React.Component {

  constructor(props, context) {
    super(props, context);
    this.DEFAULT_LIMIT = 5;
    this.state = {
      limit: this.DEFAULT_LIMIT,
    };
    this.handleLimitClick = this.handleLimitClick.bind(this);
  }

  handleLimitClick() {
    const limit = this.state.limit ? 0 : this.DEFAULT_LIMIT;
    this.setState({limit});
  }

  render() {
    const { matches = makeMap() } = this.props;
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

    const headerStyle = {
      textAlign: 'left'
    };
    const cellStyle = {
      textAlign: 'left',
      paddingRight: 10,
      maxWidth: 140
    };

    return (
      <div className="node-details-generic-table">
        <table>
          <thead>
            {this.props.columns.map(column => (
              <th className="node-details-generic-table-header" key={column.id} style={headerStyle}>
                {column.label}
              </th>
            ))}
          </thead>
          <tbody>
            {rows.map(row => (
              <tr className="node-details-generic-table-row" key={row.id}>
                {this.props.columns.map(column => (
                  <td
                    className="node-details-generic-table-field-value truncate"
                    title={row.entries[column.id]} key={column.id} style={cellStyle}>
                    <MatchedText text={row.entries[column.id]} match={matches.get(column.id)} />
                  </td>
                ))}
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
