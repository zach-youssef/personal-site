import React from 'react'
import { Dropdown } from 'react-bootstrap'

export enum AgentType {
    ASTAR, 
    MANUAL,
    QAGENT
}

interface Props {
    onAgentSelect: (agentType: AgentType) => void
}

function AgentSelector({onAgentSelect}: Props) {
    return (
        <Dropdown>
            <Dropdown.Toggle variant="secondary">
                Agent Select
            </Dropdown.Toggle>
            <Dropdown.Menu>
                {/* onClick, not onSelect: react-bootstrap 2 calls an item's onSelect only through a Dropdown-level onSelect */}
                <Dropdown.Item onClick={() => onAgentSelect(AgentType.ASTAR)}> AStar </Dropdown.Item>
                <Dropdown.Item onClick={() => onAgentSelect(AgentType.MANUAL)}> Manual </Dropdown.Item>
                <Dropdown.Item onClick={() => onAgentSelect(AgentType.QAGENT)}> QAgent </Dropdown.Item>
            </Dropdown.Menu>
        </Dropdown>
    )
}

export default AgentSelector;