#ifndef seam_carver_h
#define seam_carver_h

#include <stb_image.h>
#include <graph_image.h>

typedef struct seam_carver {
    graph_image* graph_image;
    stbi_uc* input_buffer;
    stbi_uc* output_buffer;
} seam_carver;

seam_carver seam_carver_load_image(const char* filename);

void seam_carver_resize_graph(seam_carver sc, int target_width, int target_height);

void seam_carver_write_image(seam_carver sc, const char* filename);

void seam_carver_free(seam_carver sc);

#endif // seam_carver_h