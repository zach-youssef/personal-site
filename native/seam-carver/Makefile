INCLUDE=include
OUT=build
SRC=src

CC=gcc
CFLAGS=-I$(INCLUDE)

TEST_IMAGE=test-image.png

$(OUT)/%.o: $(SRC)/%.c $(INCLUDE)/*.h
	mkdir -p $(OUT)
	$(CC) -c -o $@ $< $(CFLAGS)

_SOURCE = $(shell ls $(SRC) | grep .c)
_OBJ = $(subst .c,.o,$(_SOURCE))
OBJ = $(patsubst %,$(OUT)/%,$(_OBJ))

seam-carver: $(OBJ)
	$(CC) -o $@ $^ -lm

.PHONY: clean build mem-test

clean:
	rm -f $(OUT)/*.o seam-carver

build: seam-carver

mem-test: seam-carver $(TEST_IMAGE)
	valgrind ./$^