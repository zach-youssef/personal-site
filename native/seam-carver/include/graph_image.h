#ifndef graph_image_h
#define graph_image_h

#include <graph_pixel.h>
#include <stb_image.h>
#include <graph_seam.h>

typedef struct graph_image {
    int width, height;

    int verticalSeamsRemoved, horizontalSeamsRemoved;

    graph_pixel** graph;
    graph_pixel** nopixels;

    graph_pixel* origin;
} graph_image;

graph_image graph_image_from_image(stbi_uc* image_buffer, int width, int height);

int graph_image_remove_vertical_seam(graph_image* self);

int graph_image_remove_horizontal_seam(graph_image* self);

stbi_uc* graph_image_to_image_buffer(graph_image* self);

void graph_image_free(graph_image* graph_image);

#endif // graph_image_h