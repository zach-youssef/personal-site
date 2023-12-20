#include <stdio.h>
#include <stb_image.h>

int main(int argc, char* argv[]) {
    if (argc < 2) {
        printf("No file name specified");
        return 1;
    }

    const char* filename = argv[1];
    int width, height, channels;

    stbi_uc* image = stbi_load(filename, &width, &height, &channels, STBI_rgb);

    // TODO - actual work

    stbi_image_free(image);

    return 0;
}