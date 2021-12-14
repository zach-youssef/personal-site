import React from 'react';
import { ButtonGroup, Button } from 'react-bootstrap';

interface Props {
    currentIndex: number
    solutionLength: number
    disableNext: boolean
    onNext: () => void
    onUndo: () => void
}

function SokobanStepperControls({currentIndex, solutionLength, disableNext, onNext, onUndo}: Props) {
    return (
        <ButtonGroup>
            <Button 
                disabled={disableNext || currentIndex >= solutionLength}
                onClick={onNext}
            > 
                Next Move 
            </Button>
            <Button 
                disabled={currentIndex <= 0} 
                variant="secondary"
                onClick={onUndo}
            > 
                Undo 
            </Button>
        </ButtonGroup>
    );   
}

export default SokobanStepperControls;