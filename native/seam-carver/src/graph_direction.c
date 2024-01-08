#include <graph_direction.h>

graph_direction graph_direction_opposite(graph_direction direction) {
    switch(direction) {
        case TOP_LEFT: return DOWN_RIGHT;
        case DOWN_RIGHT: return TOP_LEFT;

        case UP: return DOWN;
        case DOWN: return UP;

        case TOP_RIGHT: return DOWN_LEFT;
        case DOWN_LEFT: return TOP_RIGHT;

        case RIGHT: return LEFT;
        case LEFT: return RIGHT;
    }
}

void graph_direction_top(graph_direction* top_directions){
    top_directions[0] = TOP_LEFT;
    top_directions[1] = UP;
    top_directions[2] = TOP_RIGHT;
}

void graph_direction_down(graph_direction* down_directions){
    down_directions[0] = DOWN_LEFT;
    down_directions[1] = DOWN;
    down_directions[2] = DOWN_RIGHT;
}

void graph_direction_right(graph_direction* right_directions){
    right_directions[0] = TOP_RIGHT;
    right_directions[1] = RIGHT;
    right_directions[2] = DOWN_RIGHT;
}

void graph_direction_left(graph_direction* left_directions){
    left_directions[0] = TOP_LEFT;
    left_directions[1] = LEFT;
    left_directions[2] = DOWN_LEFT;
}