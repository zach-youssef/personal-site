#include <graph_image.h>

graph_pixel** graph_from_file(stbi_uc* image_buffer, int width, int height);

graph_image graph_image_from_image(stbi_uc* image_buffer, int width, int height) {
    graph_image image = {width, height, 0, 0, graph_from_file(image_buffer, width, height)};
    return image;
}

void graph_image_remove_vertical_seam(graph_image* self) {
    // TODO
}

void graph_image_remove_horizontal_seam(graph_image* self) {
    // TODO
}

stbi_uc* graph_image_to_image_buffer(graph_image* self) {
    // TODO
    return NULL;
}

void graph_image_free(graph_image* graph_image) {
    for (int row = 0; row < graph_image->height; ++row) {
        free(graph_image->graph[row]);
    }
    free(graph_image->graph);
}

graph_pixel** graph_from_file(stbi_uc* image_buffer, int width, int height) {
    graph_pixel** graph = (graph_pixel**) malloc(height * sizeof(graph_pixel*));
    for (int row = 0; row < height; ++row) {
        graph[row] = (graph_pixel*) malloc(width * sizeof(graph_pixel));
        for (int col = 0; col < width; ++ col) {
            // TODO initialize pixels
        }
    }
}