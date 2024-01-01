#include <stdio.h>

#include <stb_image.h>
#include <stb_image_write.h>

#include <graph_image.h>

int main(int argc, char* argv[]) {
    if (argc < 2) {
        printf("No file name specified");
        return 1;
    }

    const char* filename = argv[1];

    // Variables for image metadata
    int width, height, channels;

    // Load image file
    stbi_uc* image = stbi_load(filename, &width, &height, &channels, STBI_rgb);

    if (image) {
        printf("DEBUG: Image is not nullptr\n");
    } else {
        printf("DEBUG: Image IS nullptr\n");
    }

    // TODO take in a target width and height, and output file
    int target_width = width / 2, target_height = height / 2;
    const char* outfilename = "out.png";

    // Create graph representation
    graph_image* graph = graph_image_from_image(image, width, height);

    // Resize graph image
    int out_width = width;
    int out_height = height;
    for (int h_count = 0; h_count < (height - target_height); ++h_count) {
        out_height -= graph_image_remove_horizontal_seam(graph);
    }
    for (int v_count = 0; v_count < (width - target_width); ++v_count) {
        out_width -= graph_image_remove_vertical_seam(graph);
    }

    // Produce output image
    stbi_uc* output = (stbi_uc*) malloc(STBI_rgb * sizeof(stbi_uc) * out_width * out_height);
    graph_image_write_to_image_buffer(graph, output);

    // Write the output image
    int result = stbi_write_png(outfilename, out_width, out_height, STBI_rgb, output, STBI_rgb * out_width);

    // Free the pixel graph
    graph_image_free(graph);

    // Free the output buffer
    free(output);

    // Free original image
    stbi_image_free(image);

    return !result;
}