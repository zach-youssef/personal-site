#include <graph_image.h>

graph_pixel** graph_from_file(stbi_uc* image_buffer, int width, int height);
graph_pixel** allocate_no_pixels(graph_pixel** origin, int width, int height);

graph_pixel** allocate_neighbor_array();

graph_image graph_image_from_image(stbi_uc* image_buffer, int width, int height) {
    GRAPH_SEAM_EMPTY_SINGLETON = graph_seam_empty();
    graph_image image = {
        width, height, 
        0, 0, 
        graph_from_file(image_buffer, width, height), 
    };

    image.nopixels = allocate_no_pixels(&(image.origin), width, height);

    return image;
}

int graph_image_remove_vertical_seam(graph_image* self) {
    // TODO
    return 0;
}

int graph_image_remove_horizontal_seam(graph_image* self) {
    // TODO
    return 0;
}

void graph_image_write_to_image_buffer(graph_image* self, stbi_uc* image_buffer) {
    // TODO
}

void graph_image_free(graph_image* graph_image) {
    for (int row = 0; row < graph_image->height; ++row) {
        for (int col = 0; col < graph_image->width; ++col) {
            free(graph_image->graph[row][col].pixel.pixel.neighbors);
        }
        free(graph_image->graph[row]);
    }
    free(graph_image->graph);

    for (int row = 0; row < (graph_image->height + 2); ++row) {
        const int row_width = (row == 0 || row == graph_image->height - 1) ? 2 : graph_image->width + 2;
        for (int col = 0; col < row_width; ++col) {
            free(graph_image->nopixels[row][col].pixel.no_pixel.neighbors);
        }
        free(graph_image->nopixels[row]);
    }
    free(graph_image->nopixels);
}

graph_pixel** graph_from_file(stbi_uc* image_buffer, int width, int height) {
    graph_pixel** graph = (graph_pixel**) malloc(height * sizeof(graph_pixel*));
    for (int row = 0; row < height; ++row) {
        graph[row] = (graph_pixel*) malloc(width * sizeof(graph_pixel));
        for (int col = 0; col < width; ++ col) {
            stbi_uc* rgb = &image_buffer[(row * width + col) * STBI_rgb];
            graph_pixel_pixel pixel = {
                allocate_neighbor_array(),
                rgb,
                GRAPH_SEAM_EMPTY_SINGLETON,
                row, col
            };
            graph_pixel_subclass subclass;
            subclass.pixel = pixel;
            graph_pixel pixel_pixel = {Pixel, subclass};

            graph[row][col] = pixel_pixel;
            graph[row][col].pixel.pixel.seam = graph_seam_for_pixel(&graph[row][col].pixel.pixel);
        }
    }
    return graph;
}

graph_pixel** allocate_no_pixels(graph_pixel** origin, int width, int height) {
    graph_pixel** nopixels = (graph_pixel**) malloc((height + 2) * sizeof(graph_pixel*));
    for(int row = 0; row < (height + 2); ++row) {
        const int row_width = (row == 0 || row == height - 1) ? 2 : width + 2;
        nopixels[row] = (graph_pixel*) malloc (row_width * sizeof(graph_pixel));
        for (int col = 0; col < row_width; ++col) {
            const bool is_origin = row == 0 && col == 0;
            graph_pixel_no_pixel no_pixel = {
                allocate_neighbor_array(),
                is_origin,
                origin
            };
            graph_pixel_subclass subclass;
            subclass.no_pixel = no_pixel;
            graph_pixel pixel_nopixel = {NoPixel, subclass};
            nopixels[row][col] = pixel_nopixel;

            if(is_origin) {
                *origin = &nopixels[row][col];
            }
        }
    }
    return nopixels;
}

graph_pixel** allocate_neighbor_array() {
    graph_pixel** neighbors = (graph_pixel**) malloc(8 * sizeof(graph_pixel*));
    return neighbors;
}