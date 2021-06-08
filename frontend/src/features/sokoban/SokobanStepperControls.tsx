import React from 'react';
import { ButtonGroup, Button } from 'react-bootstrap';

interface Props {
    currentIndex: number
    solutionLength: number
    onNext: () => void
    onUndo: () => void
}

function SokobanStepperControls({currentIndex, solutionLength, onNext, onUndo}: Props) {
    return (
        <ButtonGroup>
            <Button 
                disabled={currentIndex >= solutionLength}
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