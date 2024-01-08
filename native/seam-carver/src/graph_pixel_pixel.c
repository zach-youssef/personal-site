#include <stddef.h>
#include <math.h>

#include <graph_pixel_pixel.h>

void update_seam(graph_pixel_pixel* self, graph_direction* update_dirs);

double h_energy(graph_pixel_pixel* self);
double v_energy(graph_pixel_pixel* self);

double graph_pixel_pixel_brightness(graph_pixel_pixel* self) {
    double brightness = 0.0;
    for (int i = 0; i < STBI_rgb; ++i) {
        brightness += self->rgb[i];
    }
    static const stbi_uc MAX = ~0;
    brightness /= (STBI_rgb * MAX);
    return brightness;
}

double graph_pixel_pixel_energy(graph_pixel_pixel* self) {
    return sqrt(pow(v_energy(self), 2) + pow(h_energy(self), 2));
}

double h_energy(graph_pixel_pixel* self) {
    double energy = 0;
    graph_direction dirs[3];

    graph_direction_top(dirs);
    for (int i = 0; i < 3; ++i) {
        energy += graph_pixel_brightness(self->neighbors[dirs[i]]);
    }
    graph_direction_down(dirs);
    for (int i = 0; i < 3; ++i) {
        energy -= graph_pixel_brightness(self->neighbors[dirs[i]]);
    }

    return energy;
}

double v_energy(graph_pixel_pixel* self) {
    double energy = 0;
    graph_direction dirs[3];

    graph_direction_left(dirs);
    for (int i = 0; i < 3; ++i) {
        energy += graph_pixel_brightness(self->neighbors[dirs[i]]);
    }
    graph_direction_right(dirs);
    for (int i = 0; i < 3; ++i) {
        energy -= graph_pixel_brightness(self->neighbors[dirs[i]]);
    }

    return energy;
}

double graph_pixel_pixel_seam_weight(graph_pixel_pixel* self) {
    return graph_seam_get_weight(&self->seam);
}

graph_seam_node* graph_pixel_pixel_get_seam(graph_pixel_pixel* self) {
    return &self->seam;
}

graph_pixel_pixel* graph_pixel_pixel_farthest(graph_pixel_pixel* self, graph_direction direction) {
    return graph_pixel_farthest_with_last(self->neighbors[direction], direction, self);
}

graph_pixel_pixel* graph_pixel_pixel_farthest_with_last(graph_pixel_pixel* self, graph_direction direction, graph_pixel_pixel* last) {
    return graph_pixel_farthest_with_last(self->neighbors[direction], direction, self);
}

void graph_pixel_pixel_update_seam_vertically(graph_pixel_pixel* self) {
    graph_direction update_dirs[3];
    graph_direction_top(update_dirs);
    update_seam(self, update_dirs);
}

void graph_pixel_pixel_update_seam_horizontally(graph_pixel_pixel* self) {
    graph_direction update_dirs[3];
    graph_direction_left(update_dirs);
    update_seam(self, update_dirs);
}

void update_seam(graph_pixel_pixel* self, graph_direction* update_dirs) {
    graph_seam_node* best_seam = &GRAPH_SEAM_EMPTY_SINGLETON;

    for (int i = 0; i < 3; ++i) {
        best_seam = graph_seam_best(best_seam, graph_pixel_get_seam(self->neighbors[update_dirs[i]]));
    }

    self->seam.node.node.total_weight = graph_pixel_pixel_energy(self) + graph_seam_get_weight(best_seam);
    self->seam.node.node.came_from = best_seam;
    self->seam.node.node.pixel = self;
}

int graph_pixel_pixel_remove(graph_pixel_pixel* self, graph_direction shift_dir) {
    graph_pixel_add_neighbor(self->neighbors[graph_direction_opposite(shift_dir)], self->neighbors[shift_dir], shift_dir);

    graph_pixel_shift_in(self->neighbors[graph_direction_opposite(shift_dir)], self->neighbors, shift_dir);

    return 1;
}