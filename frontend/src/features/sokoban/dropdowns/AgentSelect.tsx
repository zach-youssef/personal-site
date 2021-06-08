import React from 'react'
import { Dropdown } from 'react-bootstrap'

function AgentSelector() {
    return (
        <Dropdown>
            <Dropdown.Toggle variant="secondary">
                Agent Select
            </Dropdown.Toggle>
            <Dropdown.Menu>
                <Dropdown.Item> AStar </Dropdown.Item>
                <Dropdown.Item disabled> QAgent </Dropdown.Item>
            </Dropdown.Menu>
        </Dropdown>
    )
}

export default AgentSelector;