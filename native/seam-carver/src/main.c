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

    // TODO take in a target width and height, and output file
    int target_width = width / 2, target_height = height / 2;
    const char* outfilename = "out.png";

    // Load image file
    stbi_uc* image = stbi_load(filename, &width, &height, &channels, STBI_rgb);

    // Create graph representation
    graph_image graph = graph_image_from_image(image, width, height);

    // Free original image
    stbi_image_free(image);

    // Resize graph image
    for (int h_count = 0; h_count < (height - target_height); ++h_count) {
        graph_image_remove_vertical_seam(&graph);
    }
    for (int v_count = 0; v_count < (width - target_width); ++v_count) {
        graph_image_remove_horizontal_seam(&graph);
    }

    // Produce output image
    stbi_uc* output = graph_image_to_image_buffer(&graph);

    // Free the pixel graph
    graph_image_free(&graph);

    // Write the output image
    int result = stbi_write_png(outfilename, target_width, target_height, STBI_rgb, output, sizeof(stbi_uc) * target_width);

    return 0;
}