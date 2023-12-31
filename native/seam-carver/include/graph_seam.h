#ifndef graph_seam_h
#define graph_seam_h

struct graph_pixel_pixel;
struct graph_seam_node;

typedef enum graph_seam_node_type {
    graph_seam_node_type_node,
    graph_seam_node_type_no_node
} graph_seam_node_type;

typedef struct graph_seam_node_node {
    struct graph_pixel_pixel* pixel;
    double total_weight;
    struct graph_seam_node* came_from;
} graph_seam_node_node;

typedef struct graph_seam_node_no_node {
} graph_seam_node_no_node;

typedef union graph_seam_node_subclass {
    graph_seam_node_node node;
    graph_seam_node_no_node no_node;
} graph_seam_node_subclass;

typedef struct graph_seam_node {
    graph_seam_node_type type;
    graph_seam_node_subclass node;
} graph_seam_node;

graph_seam_node GRAPH_SEAM_EMPTY_SINGLETON;

graph_seam_node graph_seam_empty();
graph_seam_node graph_seam_for_pixel(struct graph_pixel_pixel* pixel);

#endif // graph_seam_h