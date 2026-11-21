---
title: Spec-Guard
colorFrom: indigo
colorTo: green
sdk: static
app_file: index.html
pinned: false
short_description: Specification-guarded visual programs, archived results
---

# Spec-Guard: public showcase

M.Tech CSE (Information Security and Privacy), SVNIT Surat. Guide: Prof. Mukesh A. Zaveri.

This site is the Spec-Guard demo interface without a server or a GPU. Every page reads the archived
runs of the dissertation, exported once by `deploy/export_static.py`: the overview, the test set
explorer (OpenRef, RefCOCO, RefCOCO+, RefCOCOg, with every archived program and property test), the
results with the best result of every model, the models and the architecture. Nothing is recomputed
here beyond the reproduction controls the service also runs at start-up. The live demo, which runs
the code models and SAM 3 on a new image, needs about 54 GB of GPU memory and is shown only from the
SVNIT cluster.

Data: OpenRef test images (arXiv 2605.25706); COCO train2014 images (Lin et al., 2014), shown as
reduced copies under their original Flickr licences, for the RefCOCO family. Research prototype for
referring-expression grounding; not for identifying or tracking people.
