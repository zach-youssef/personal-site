#ifndef graph_pixel_pixel_h
#define graph_pixel_pixel_h

#include <graph_pixel.h>

double graph_pixel_pixel_brightness(graph_pixel_pixel* self); 

double graph_pixel_pixel_energy(graph_pixel_pixel* self); 

double graph_pixel_pixel_seam_weight(graph_pixel_pixel* self); 

graph_seam_node* graph_pixel_pixel_get_seam(graph_pixel_pixel* self); 

graph_pixel_pixel* graph_pixel_pixel_farthest(graph_pixel_pixel* self, graph_direction direction); 

graph_pixel_pixel* graph_pixel_pixel_farthest_with_last(graph_pixel_pixel* self, graph_direction direction, graph_pixel_pixel* last); 

void graph_pixel_pixel_update_seam_vertically(graph_pixel_pixel* self);

void graph_pixel_pixel_update_seam_horizontally(graph_pixel_pixel* self);

int graph_pixel_pixel_remove(graph_pixel_pixel* self, graph_direction shift_dir);

#endif // graph_pixel_pixel_h