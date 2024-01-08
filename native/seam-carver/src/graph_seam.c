#include <graph_seam.h>
#include <graph_pixel_pixel.h>

graph_seam_node graph_seam_empty() {
    graph_seam_node_no_node no_info = {};
    graph_seam_node_subclass subclass;
    subclass.no_node = no_info;
    graph_seam_node no_node = {graph_seam_node_type_no_node, subclass};
    return no_node;
}

graph_seam_node graph_seam_for_pixel(struct graph_pixel_pixel* pixel) {
    graph_seam_node_node node = {pixel, 0, &GRAPH_SEAM_EMPTY_SINGLETON};
    graph_seam_node_subclass subclass;
    subclass.node = node;
    graph_seam_node seam_node = {graph_seam_node_type_node, subclass};
    return seam_node;
}

int graph_seam_remove_vertical(graph_seam_node* seam) {
    if (seam->type == graph_seam_node_type_no_node) {
        return 1;
    }

    graph_seam_node_node* node = &seam->node.node;

    return graph_pixel_pixel_remove(node->pixel, LEFT) 
           * graph_seam_remove_vertical(node->came_from);
}

int graph_seam_remove_horizontal(graph_seam_node* seam) {
    if (seam->type == graph_seam_node_type_no_node) {
        return 1;
    }

    graph_seam_node_node* node = &seam->node.node;

    return graph_pixel_pixel_remove(node->pixel, UP) 
           * graph_seam_remove_horizontal(node->came_from);
}

graph_seam_node* graph_seam_best_dd(graph_seam_node_node* node, graph_seam_node* node_parent, graph_seam_node* other);

graph_seam_node* graph_seam_best(graph_seam_node* seam1, graph_seam_node* seam2) {
    switch(seam1->type){
        case graph_seam_node_type_no_node: return seam2;
        case graph_seam_node_type_node: return graph_seam_best_dd(&seam1->node.node, seam1, seam2);
    }
}

graph_seam_node* graph_seam_best_dd(graph_seam_node_node* node, graph_seam_node* node_parent, graph_seam_node* other) {
    switch(other->type) {
        case graph_seam_node_type_no_node: return node_parent;
        case graph_seam_node_type_node: return node->total_weight < other->node.node.total_weight ? node_parent : other;
    }
}

double graph_seam_get_weight(graph_seam_node* seam) {
    switch (seam->type) {
        case graph_seam_node_type_node: return seam->node.node.total_weight;
        case graph_seam_node_type_no_node: return 0;
    }
}