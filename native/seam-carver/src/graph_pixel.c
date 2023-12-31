#include <stddef.h>

#include <graph_pixel.h>
#include <graph_pixel_pixel.h>
#include <graph_pixel_no_pixel.h>
#include <graph_direction.h>

graph_pixel** get_neighbors(graph_pixel* self);

graph_pixel** get_neighbors(graph_pixel* self) {
    switch(self->type) {
        case Pixel: return self->pixel.pixel.neighbors;
        case NoPixel: return self->pixel.no_pixel.neighbors;
    }
}

double graph_pixel_brightness(graph_pixel* self){
    switch(self->type) {
        case Pixel: return graph_pixel_pixel_brightness(&(self->pixel.pixel));
        case NoPixel: return graph_pixel_no_pixel_brightness(&(self->pixel.no_pixel));
    }
}

double graph_pixel_energy(graph_pixel* self) {
    switch(self->type) {
        case Pixel: return graph_pixel_pixel_energy(&(self->pixel.pixel));
        case NoPixel: return graph_pixel_no_pixel_energy(&(self->pixel.no_pixel));
    }
}

double graph_pixel_seam_weight(graph_pixel* self) {
    switch(self->type) {
        case Pixel: return graph_pixel_pixel_seam_weight(&(self->pixel.pixel));
        case NoPixel: return graph_pixel_no_pixel_seam_weight(&(self->pixel.no_pixel));
    }
}

graph_seam_node graph_pixel_get_seam(graph_pixel* self) {
    switch(self->type) {
        case Pixel: return graph_pixel_pixel_get_seam(&(self->pixel.pixel));
        case NoPixel: return graph_pixel_no_pixel_get_seam(&(self->pixel.no_pixel));
    }
}

void graph_pixel_shift_in(graph_pixel* self, graph_pixel** new_neighbors, graph_direction direction) {
    // TODO
}

void graph_pixel_set_neighbor(graph_pixel* self, graph_direction direction, graph_pixel* pixel) {
    get_neighbors(self)[direction] = pixel;
}

void graph_pixel_add_neighbor(graph_pixel* self, graph_pixel* other, graph_direction direction) {
    get_neighbors(self)[direction] = other;
    graph_pixel_set_neighbor(other, graph_direction_opposite(direction), self);
}

graph_pixel* graph_pixel_farthest(graph_pixel* self, graph_direction direction) {
    switch(self->type) {
        case Pixel: return graph_pixel_pixel_farthest(&(self->pixel.pixel), direction);
        case NoPixel: return graph_pixel_no_pixel_farthest(&(self->pixel.no_pixel), direction);
    }
}

graph_pixel* graph_pixel_farthest_with_last(graph_pixel* self, graph_direction direction, graph_pixel* last) {
    switch(self->type) {
        case Pixel: return graph_pixel_pixel_farthest_with_last(&(self->pixel.pixel), direction, last);
        case NoPixel: return graph_pixel_no_pixel_farthest_with_last(&(self->pixel.no_pixel), direction, last);
    }
}

void graph_pixel_add_if_pixel(graph_pixel* self, graph_pixel_list* pixel_list) {
    // TODO
}

void graph_pixel_add_neighbor_if_pixel(graph_pixel* self, graph_direction direction, graph_pixel_list* pixel_list) {
    // TODO
}

void graph_pixel_shift_out(graph_pixel* self, graph_direction direction) {
    // TODO
}

bool graph_pixel_has_neighbor(graph_pixel* self, graph_direction dir, graph_pixel* pixel) {
    // TODO
    return false;
}

graph_pixel* graph_pixel_find_position(graph_pixel* self, unsigned int x, unsigned int y) {
    // TODO 
    return NULL;
}