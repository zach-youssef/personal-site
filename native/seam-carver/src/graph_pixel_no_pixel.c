#include <stddef.h>

#include <graph_pixel_no_pixel.h>

double graph_pixel_no_pixel_brightness(graph_pixel_no_pixel* self) {
    return 0;
}

double graph_pixel_no_pixel_energy(graph_pixel_no_pixel* self) {
    return 0;
}

double graph_pixel_no_pixel_seam_weight(graph_pixel_no_pixel* self) {
    return 0;
}

graph_seam_node* graph_pixel_no_pixel_get_seam(graph_pixel_no_pixel* self){
    return &GRAPH_SEAM_EMPTY_SINGLETON;
} 

graph_pixel_pixel* graph_pixel_no_pixel_farthest(graph_pixel_no_pixel* self, graph_direction direction){
    return graph_pixel_farthest_with_last(self->neighbors[direction], direction, NULL);
} 

graph_pixel_pixel* graph_pixel_no_pixel_farthest_with_last(graph_pixel_no_pixel* self, graph_direction direction, graph_pixel_pixel* last){
    return last;
} 

void no_pixel_set_as_origin(graph_pixel* pixel) {
    if (pixel->type == NoPixel) {
        graph_pixel_no_pixel* self = &pixel->pixel.no_pixel;
        self->is_origin = true;
        *(self->origin) = pixel;
    }
}