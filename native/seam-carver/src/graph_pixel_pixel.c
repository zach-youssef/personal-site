#include <stddef.h>

#include <graph_pixel_pixel.h>

void update_seam(graph_pixel_pixel* self, graph_direction update_dir);
graph_pixel super(graph_pixel_pixel* self);

double graph_pixel_pixel_brightness(graph_pixel_pixel* self) {
    // TODO
    return 0;
}

double graph_pixel_pixel_energy(graph_pixel_pixel* self) {
    // TODO
    return 0;
}

double graph_pixel_pixel_seam_weight(graph_pixel_pixel* self) {
    // TODO
    return 0;
}

graph_seam_node graph_pixel_pixel_get_seam(graph_pixel_pixel* self) {
    // TODO
    graph_seam_node node = {};
    return node;
}

graph_pixel_pixel* graph_pixel_pixel_farthest(graph_pixel_pixel* self, graph_direction direction) {
    return graph_pixel_farthest_with_last(self->neighbors[direction], direction, self);
}

graph_pixel_pixel* graph_pixel_pixel_farthest_with_last(graph_pixel_pixel* self, graph_direction direction, graph_pixel_pixel* last) {
    return graph_pixel_farthest_with_last(self->neighbors[direction], direction, self);
}

void graph_pixel_pixel_add_if_pixel(graph_pixel_pixel* self, graph_pixel_list* pixel_list) {
    // TODO
}

graph_pixel* graph_pixel_pixel_find_position(graph_pixel_pixel* self, unsigned int x, unsigned int y) {
    // TODO
    return NULL;
}

void graph_pixel_pixel_update_seam_vertically(graph_pixel_pixel* self) {
    // TODO
}

int graph_pixel_pixel_remove(graph_pixel_pixel* self, graph_direction shift_dir) {
    // TODO
    return 0;
}