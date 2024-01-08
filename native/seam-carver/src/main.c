#include <stdio.h>

#include <seam_carver.h>

int main(int argc, char* argv[]) {
    if (argc < 2) {
        printf("No file name specified");
        return 1;
    }

    const char* filename = argv[1];

    // Load image file & construct graph
    seam_carver sc = seam_carver_load_image(filename);

    // Resize graph by removing seems to match target size
    // TODO take in target width / height as arguments
    int targetWidth = 500;
    int targetHeight = 500;
    seam_carver_resize_graph(sc, targetWidth, targetHeight);

    // Write the image to the output file
    // TODO take in output file as argument
    const char* out_filename = "out.png";
    seam_carver_write_image(sc, out_filename);

    // Free all allocated memory
    seam_carver_free(sc);
}