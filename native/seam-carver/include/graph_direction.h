#ifndef graph_direction_h
#define graph_direction_h

typedef enum {
  TOP_LEFT,     UP,     TOP_RIGHT, 
  RIGHT,                LEFT,
  DOWN_RIGHT,   DOWN,   DOWN_LEFT
} graph_direction;

graph_direction graph_direction_opposite(graph_direction direction);

void graph_direction_top(graph_direction* top_directions);

void graph_direction_down(graph_direction* down_directions);

void graph_direction_right(graph_direction* right_directions);

void graph_direction_left(graph_direction* left_directions);

void graph_direction_shift_indices(graph_direction direction, int* row, int* col);

#endif // graph_direction_h