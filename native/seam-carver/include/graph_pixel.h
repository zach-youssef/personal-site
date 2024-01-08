#ifndef graph_pixel_h
#define graph_pixel_h

#include <stdbool.h>
#include <stb_image.h>

#include <graph_direction.h>
#include <graph_seam.h>

enum graph_pixel_type {
    Pixel,
    NoPixel
};

struct graph_pixel;

typedef struct graph_pixel_pixel {
    struct graph_pixel** neighbors;
    stbi_uc* rgb;
    graph_seam_node seam;

    int row;
    int col;
} graph_pixel_pixel;

typedef struct graph_pixel_no_pixel {
    struct graph_pixel** neighbors;
    bool is_origin;
    struct graph_pixel** origin;
} graph_pixel_no_pixel;

typedef union graph_pixel_subclass {
    graph_pixel_pixel pixel;
    graph_pixel_no_pixel no_pixel;
} graph_pixel_subclass;

typedef struct graph_pixel {
    enum graph_pixel_type type;
    union graph_pixel_subclass pixel;
} graph_pixel;

double graph_pixel_brightness(graph_pixel* self); // abstract

double graph_pixel_energy(graph_pixel* self); // abstract

double graph_pixel_seam_weight(graph_pixel* self); // abstract

graph_seam_node* graph_pixel_get_seam(graph_pixel* self); // abstract

void graph_pixel_shift_in(graph_pixel* self, graph_pixel** new_neighbors, graph_direction direction);

void graph_pixel_set_neighbor(graph_pixel* self, graph_direction direction, graph_pixel* pixel);

void graph_pixel_add_neighbor(graph_pixel* self, graph_pixel* other, graph_direction direction);

graph_pixel_pixel* graph_pixel_farthest(graph_pixel* self, graph_direction direction); // abstract

graph_pixel_pixel* graph_pixel_farthest_with_last(graph_pixel* self, graph_direction direction, graph_pixel_pixel* last); // abstract

#endif // graph_pixel_h