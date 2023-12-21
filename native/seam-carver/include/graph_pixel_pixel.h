#ifndef graph_pixel_pixel_h
#define graph_pixel_pixel_h

#include <graph_pixel.h>

double graph_pixel_pixel_brightness(graph_pixel_pixel* self); 

double graph_pixel_pixel_energy(graph_pixel_pixel* self); 

double graph_pixel_pixel_seam_weight(graph_pixel_pixel* self); 

graph_seam_node graph_pixel_pixel_get_seam(graph_pixel_pixel* self); 

graph_pixel* graph_pixel_pixel_farthest(graph_pixel_pixel* self, graph_direction direction); 

graph_pixel* graph_pixel_pixel_farthest_with_last(graph_pixel_pixel* self, graph_direction direction, graph_pixel* last); 

void graph_pixel_pixel_add_if_pixel(graph_pixel_pixel* self, graph_pixel_list* pixel_list); 

graph_pixel* graph_pixel_pixel_find_position(graph_pixel_pixel* self, unsigned int x, unsigned int y); 

#endif // graph_pixel_pixel_h