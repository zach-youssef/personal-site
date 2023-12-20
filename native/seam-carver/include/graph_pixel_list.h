#ifndef graph_pixel_list_h
#define graph_pixel_list_h

struct graph_pixel;
struct graph_pixel_list_node;

enum graph_pixel_list_node_type {
    Node,
    Sentitnel
};

typedef struct graph_pixel_list_node_node {
    struct graph_pixel* pixel;
    struct graph_pixel_list_node* next;
    struct graph_pixel_list_node* previous;
} graph_pixel_list_node_node;

typedef struct graph_list_node_sentinel {
    struct graph_pixel_list_node* first;
    struct graph_pixel_list_node* last;
} graph_list_node_sentinel;

union graph_pixel_list_node_subclass {
    graph_pixel_list_node_node node;
    graph_pixel_list_node_node sentinel;
};

struct graph_pixel_list_node {
    enum graph_pixel_list_node_type type;
    union graph_pixel_list_node_subclass node;
};

typedef struct graph_pixel_list {
    graph_list_node_sentinel sentinel;
} graph_pixel_list;

#endif // graph_pixel_list_h