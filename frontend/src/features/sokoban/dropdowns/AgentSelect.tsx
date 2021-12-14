import React from 'react'
import { Dropdown } from 'react-bootstrap'

export enum AgentType {
    ASTAR, 
    MANUAL,
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
                <Dropdown.Item onSelect={() => onAgentSelect(AgentType.ASTAR)}> AStar </Dropdown.Item>
                <Dropdown.Item onSelect={() => onAgentSelect(AgentType.MANUAL)}> Manual </Dropdown.Item>
                <Dropdown.Item disabled> QAgent </Dropdown.Item>
            </Dropdown.Menu>
        </Dropdown>
    )
}

export default AgentSelector;