#include <stddef.h>

#include <graph_pixel_no_pixel.h>

double graph_pixel_no_pixel_brightness(graph_pixel_no_pixel* self) {
    // TODO
    return 0;
}

double graph_pixel_no_pixel_energy(graph_pixel_no_pixel* self) {
    // TODO
    return 0;
}

double graph_pixel_no_pixel_seam_weight(graph_pixel_no_pixel* self) {
    // TODO
    return 0;
}

graph_seam_node graph_pixel_no_pixel_get_seam(graph_pixel_no_pixel* self){
    // TODO
    graph_seam_node node = {};
    return node;
} 

graph_pixel* graph_pixel_no_pixel_farthest(graph_pixel_no_pixel* self, graph_direction direction){
    // TODO
    return NULL;
} 

graph_pixel* graph_pixel_no_pixel_farthest_with_last(graph_pixel_no_pixel* self, graph_direction direction, graph_pixel* last){
    // TODO
    return NULL;
} 

void graph_pixel_no_pixel_add_if_pixel(graph_pixel_no_pixel* self, graph_pixel_list* pixel_list){
    // TODO
} 

graph_pixel* graph_pixel_no_pixel_find_position(graph_pixel_no_pixel* self, unsigned int x, unsigned int y){
    // TODO
    return NULL;
} 

void no_pixel_set_as_origin(graph_pixel* pixel) {
    if (pixel->type == NoPixel) {
        graph_pixel_no_pixel* self = &pixel->pixel.no_pixel;
        self->is_origin = true;
        *(self->origin) = pixel;
    }
}