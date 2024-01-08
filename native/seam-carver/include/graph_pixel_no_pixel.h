#ifndef graph_pixel_no_pixel_h
#define graph_pixel_no_pixel_h

#include <graph_pixel.h>

double graph_pixel_no_pixel_brightness(graph_pixel_no_pixel* self); 

double graph_pixel_no_pixel_energy(graph_pixel_no_pixel* self); 

double graph_pixel_no_pixel_seam_weight(graph_pixel_no_pixel* self); 

graph_seam_node* graph_pixel_no_pixel_get_seam(graph_pixel_no_pixel* self); 

graph_pixel_pixel* graph_pixel_no_pixel_farthest(graph_pixel_no_pixel* self, graph_direction direction); 

graph_pixel_pixel* graph_pixel_no_pixel_farthest_with_last(graph_pixel_no_pixel* self, graph_direction direction, graph_pixel_pixel* last); 

void no_pixel_set_as_origin(graph_pixel* pixel);

#endif // graph_pixel_no_pixel_h