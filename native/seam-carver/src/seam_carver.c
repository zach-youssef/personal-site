#include <seam_carver.h>
#include <stb_image_write.h>

seam_carver seam_carver_load_image(const char* filename) {
    seam_carver sc;

    int width, height, channels;
    sc.input_buffer = stbi_load(filename, &width, &height, &channels, STBI_rgb);

    sc.graph_image = graph_image_from_image(sc.input_buffer, width, height);

    return sc;
}

void seam_carver_resize_graph(seam_carver sc, int target_width, int target_height) {
    while (sc.graph_image->out_width > target_width) {
        graph_image_remove_vertical_seam(sc.graph_image);
    }
    while (sc.graph_image->out_height > target_height) {
        graph_image_remove_horizontal_seam(sc.graph_image);
    }
}

void seam_carver_write_image(seam_carver sc, const char* filename) {
    sc.output_buffer = (stbi_uc*) malloc(STBI_rgb * sizeof(stbi_uc) 
                                        * sc.graph_image->out_width
                                        * sc.graph_image->out_height);

    graph_image_write_to_image_buffer(sc.graph_image, sc.output_buffer);
    
    stbi_write_png(filename, 
                   sc.graph_image->out_width, 
                   sc.graph_image->out_height, 
                   STBI_rgb,  // Channels
                   sc.output_buffer, 
                   STBI_rgb * sc.graph_image->out_width); // Stride
}

void seam_carver_free(seam_carver sc) {
    if (sc.graph_image) {
        graph_image_free(sc.graph_image);
    }
    if (sc.output_buffer) {
        free(sc.output_buffer);
    }
    if (sc.input_buffer) {
        stbi_image_free(sc.input_buffer);
    }
}