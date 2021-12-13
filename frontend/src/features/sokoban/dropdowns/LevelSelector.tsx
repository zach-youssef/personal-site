import React, { useEffect, useState } from 'react';
import { Dropdown } from 'react-bootstrap';
import { fetchGraphQL } from '../../../FetchHelper';
import { GetAvailableLevelsQuery } from '../../../graphql/SokobanQuieries';

interface Props {
    onLevelSelect: (levelId: any) => void
}

function LevelSelector({onLevelSelect}: Props) {
    const [levelIds, setLevelIds] = useState([])
    useEffect(() => {
        let isMounted = true;
        fetchGraphQL(GetAvailableLevelsQuery, {}).then(response => {
            if (!isMounted || levelIds.length !== 0) {
                return;
            }
            const data = response.data
            setLevelIds(data.levels);
            onLevelSelect(data.levels[0])
        }).catch(error => {
            console.log(error)
        });
        
        return () => { 
            isMounted = false ;
        };
    }, [onLevelSelect])
    
    
    return(
        <Dropdown>
            <Dropdown.Toggle>
                Level Select
            </Dropdown.Toggle>
            <Dropdown.Menu>
                {levelIds.map(levelId => (
                    <Dropdown.Item
                        onSelect = {() => onLevelSelect(levelId)}
                    >
                        {levelId}
                    </Dropdown.Item>
                ))}
            </Dropdown.Menu>
        </Dropdown>
    )
}

export default LevelSelector;