#include <graph_image.h>
#include <graph_pixel_pixel.h>
#include <graph_pixel_no_pixel.h>

#include <string.h>
#include <stdio.h>

graph_pixel** graph_from_file(stbi_uc* image_buffer, int width, int height);
graph_pixel** allocate_no_pixels(graph_pixel** origin, int width, int height);

graph_pixel** allocate_neighbor_array();

graph_seam_node* next_vertical_seam(graph_image* image);

stbi_uc* buffer_lookup(stbi_uc* image_buffer, int width, int row, int col);

void link_graph(graph_image* image);

graph_image* graph_image_from_image(stbi_uc* image_buffer, int width, int height) {
    GRAPH_SEAM_EMPTY_SINGLETON = graph_seam_empty();

    graph_image* image = (graph_image*) malloc(sizeof(graph_image));

    image->width = width;
    image->out_width = width;
    image->height = height;
    image->out_height = height;
    image->horizontalSeamsRemoved = image->verticalSeamsRemoved = 0;
    image->graph = graph_from_file(image_buffer, width, height);
    image->nopixels = allocate_no_pixels(&(image->origin), width, height);

    link_graph(image);

    return image;
}

int graph_image_remove_vertical_seam(graph_image* self) {
    graph_seam_node* seam = next_vertical_seam(self);

    int seams_removed = graph_seam_remove_vertical(seam);

    self->out_width -= seams_removed;

    return seams_removed;
}

int graph_image_remove_horizontal_seam(graph_image* self) {
    // TODO
    return 0;
}

graph_seam_node* next_vertical_seam(graph_image* self) {
    // TODO move seam updating to helper?
    // TODO create some type of iterator wrapper to reuse this loop structure
    graph_pixel_no_pixel* top_left_no_pixel = &self->origin->pixel.no_pixel;
    graph_pixel* row_start = top_left_no_pixel->neighbors[DOWN_RIGHT];
    while (row_start->type == Pixel) {
        graph_pixel* current = row_start;
        while (current->type == Pixel) {
            graph_pixel_pixel* pixel = &current->pixel.pixel;
            graph_pixel_pixel_update_seam_vertically(pixel);
            current = pixel->neighbors[RIGHT];
        }
        row_start = row_start->pixel.pixel.neighbors[DOWN];
    }

    graph_pixel_pixel* bottom_row_pixel = graph_pixel_farthest(self->origin->pixel.no_pixel.neighbors[DOWN_RIGHT], DOWN);
    graph_seam_node* best_seam = &GRAPH_SEAM_EMPTY_SINGLETON;
    bool have_new_pixel = true;
    while (have_new_pixel) {
        best_seam = graph_seam_best(best_seam, &bottom_row_pixel->seam);
        graph_pixel* next = bottom_row_pixel->neighbors[RIGHT];
        if (next->type == Pixel) {
            bottom_row_pixel = &next->pixel.pixel;
        } else {
            have_new_pixel = false;
        }
    }

    return best_seam;
}

void graph_image_write_to_image_buffer(graph_image* self, stbi_uc* image_buffer) {
    int pixels_written = 0;
    // Traverse graph and copy color data to buffer
    // TODO create some type of iterator wrapper to reuse this loop structure
    graph_pixel_no_pixel* top_left_no_pixel = &self->origin->pixel.no_pixel;
    graph_pixel* row_start = top_left_no_pixel->neighbors[DOWN_RIGHT];
    while (row_start->type == Pixel) {
        graph_pixel* current = row_start;
        while (current->type == Pixel) {
            graph_pixel_pixel* pixel = &current->pixel.pixel;
            stbi_uc* dst_start = buffer_lookup(image_buffer, self->out_width, pixel->row, pixel->col);
            memcpy(dst_start, pixel->rgb, STBI_rgb);
            current = pixel->neighbors[RIGHT];

            ++pixels_written;
        }
        row_start = row_start->pixel.pixel.neighbors[DOWN];
    }

    printf("DEBUG: Wrote %d pixels.\n", pixels_written);
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
        const int row_width = (row == 0 || row == graph_image->height + 1) ? graph_image->width + 2 : 2;
        for (int col = 0; col < row_width; ++col) {
            free(graph_image->nopixels[row][col].pixel.no_pixel.neighbors);
        }
        free(graph_image->nopixels[row]);
    }
    free(graph_image->nopixels);

    free(graph_image);
}

graph_pixel** graph_from_file(stbi_uc* image_buffer, int width, int height) {
    graph_pixel** graph = (graph_pixel**) malloc(height * sizeof(graph_pixel*));
    for (int row = 0; row < height; ++row) {
        graph[row] = (graph_pixel*) malloc(width * sizeof(graph_pixel));
        for (int col = 0; col < width; ++ col) {
            stbi_uc* rgb = buffer_lookup(image_buffer, width, row, col);
            graph_pixel_pixel pixel = {
                allocate_neighbor_array(),
                rgb,
                GRAPH_SEAM_EMPTY_SINGLETON,
                row, col
            };

            graph[row][col].type = Pixel;
            graph[row][col].pixel.pixel = pixel;

            graph[row][col].pixel.pixel.seam = graph_seam_for_pixel(&graph[row][col].pixel.pixel);
        }
    }
    return graph;
}

graph_pixel** allocate_no_pixels(graph_pixel** origin, int width, int height) {
    graph_pixel** nopixels = (graph_pixel**) malloc((height + 2) * sizeof(graph_pixel*));
    for(int row = 0; row < (height + 2); ++row) {
        const int row_width = (row == 0 || row == height + 1) ? width + 2 : 2;
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

void link_graph(graph_image* image) {
    // Link pixels together
    for (int row = 0; row < image->height; ++row) {
        for (int col = 0; col < image->width; ++col) {
            graph_pixel* pixel = &(image->graph[row][col]);

            if (row > 0 && col > 0) {
                graph_pixel_add_neighbor(pixel, &(image->graph[row - 1][col - 1]), TOP_LEFT);
            }
            if (row > 0) {
                graph_pixel_add_neighbor(pixel, &(image->graph[row - 1][col]), UP);
            }
            if (col > 0) {
                graph_pixel_add_neighbor(pixel, &(image->graph[row][col - 1]), LEFT);
            }
            if (row > 0 && col < image->width - 1) {
                graph_pixel_add_neighbor(pixel, &(image->graph[row - 1][col + 1]), TOP_RIGHT);
            }
        }
    }

    // Link no-pixels to edges
    graph_direction dirs[3];
    // - Set origin
    no_pixel_set_as_origin(&image->nopixels[0][0]);
    // - Link top row
    printf("DEBUG: Link top nopixels\n");
    graph_direction_top(dirs);
    for(int col = 0; col < image->width; ++col) {
        for (int i = 0; i < 3; ++i) {
            graph_pixel_add_neighbor(&image->graph[0][col], &image->nopixels[0][col + i], dirs[i]);
        }
    }
    // - Link bottom row
    printf("DEBUG: Link bottom nopixels\n");
    graph_direction_down(dirs);
    int b_row = image->height - 1;
    for(int col = 0; col < image->width; ++col) {
        for (int i = 0; i < 3; ++i) {
            graph_pixel_add_neighbor(&image->graph[b_row][col], &image->nopixels[image->height + 1][col + i],  dirs[i]);
        }
    }
    // - Link left col
    printf("DEBUG: Link left nopixels\n");
    graph_direction_left(dirs);
    for(int row = 0; row < image->height; ++row) {
        for (int i =0; i < 3; ++i) {
            graph_pixel_add_neighbor(&image->graph[row][0], &image->nopixels[row + i][0], dirs[i]);
        }
    }
    // - Link right col
    printf("DEBUG: Link right nopixels\n");
    graph_direction_right(dirs);
    int r_col = image->width - 1;
    for(int row = 0; row < image->height; ++row) {
        for (int i = 0; i < 3; ++i) {
            int np_row = row + i;
            int np_col = (np_row == 0 && np_row == image->height + 1) ? r_col + 2 : 1;
            graph_pixel_add_neighbor(&image->graph[row][r_col], &image->nopixels[np_row][np_col], dirs[i]);
        }
    }
}

stbi_uc* buffer_lookup(stbi_uc* image_buffer, int width, int row, int col) {
    return image_buffer + (STBI_rgb * row * width) + (STBI_rgb * col);
}