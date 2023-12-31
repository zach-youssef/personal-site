#include "graph_seam.h"

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