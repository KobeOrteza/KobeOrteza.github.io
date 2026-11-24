"""
dac_board.py — procedurally models an ES9038Q2M DAC board and exports a GLB
for the portfolio's 3D hardware scene.

Run:  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python tools/blender/dac_board.py -- assets/3d/dac-board.glb

Object/material names matter: the website animates every material named "Trace"
(pulsing cyan glow) and "LED" (blinking).
"""
import bpy
import math
import sys
import random

random.seed(7)
out = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "dac-board.glb"

# ---------------------------------------------------------------- reset scene
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
    for b in list(block):
        block.remove(b)


# ---------------------------------------------------------------- materials
def mat(name, color, metallic=0.0, roughness=0.5, emission=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    return m


M = {
    "pcb": mat("PCB", (0.012, 0.03, 0.035), 0.0, 0.55),
    "silk": mat("Silkscreen", (0.75, 0.82, 0.85), 0.0, 0.6, (0.6, 0.7, 0.72), 0.25),
    "chip": mat("ChipBody", (0.015, 0.015, 0.018), 0.1, 0.35),
    "label": mat("ChipLabel", (0.7, 0.95, 0.93), 0.0, 0.4, (0.34, 0.85, 0.81), 1.6),
    "gold": mat("Gold", (1.0, 0.72, 0.38), 1.0, 0.22),
    "trace": mat("Trace", (0.2, 0.85, 0.8), 0.3, 0.3, (0.34, 0.85, 0.81), 4.0),
    "copper": mat("CopperTrace", (0.88, 0.55, 0.3), 0.6, 0.35, (0.88, 0.56, 0.31), 2.2),
    "cap": mat("CapBody", (0.06, 0.07, 0.09), 0.4, 0.3),
    "capTop": mat("CapTop", (0.75, 0.78, 0.8), 1.0, 0.25),
    "smd": mat("SMD", (0.55, 0.42, 0.28), 0.0, 0.6),
    "plastic": mat("Plastic", (0.02, 0.02, 0.025), 0.0, 0.5),
    "steel": mat("Steel", (0.8, 0.82, 0.85), 1.0, 0.2),
    "led": mat("LED", (0.6, 0.55, 1.0), 0.0, 0.2, (0.6, 0.55, 1.0), 6.0),
}


def assign(obj, m):
    obj.data.materials.clear()
    obj.data.materials.append(m)
    return obj


def box(name, loc, size, m, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel > 0:
        mod = o.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier="bevel")
    return assign(o, m)


def cyl(name, loc, r, h, m, verts=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc)
    o = bpy.context.active_object
    o.name = name
    return assign(o, m)


TOP = 0.04  # board top surface (board is 0.08 thick, centred at z=0)

# ---------------------------------------------------------------- board
box("Board", (0, 0, 0), (4.2, 3.0, 0.08), M["pcb"], bevel=0.03)

# mounting holes (gold rings)
for x in (-1.9, 1.9):
    for y in (-1.3, 1.3):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.11, minor_radius=0.03, location=(x, y, TOP + 0.005),
                                         major_segments=16, minor_segments=6)
        o = bpy.context.active_object
        o.name = "MountRing"
        assign(o, M["gold"])

# ---------------------------------------------------------------- main DAC chip (QFN-48)
CX, CY = -0.35, 0.15
box("DAC_Chip", (CX, CY, TOP + 0.07), (0.95, 0.95, 0.12), M["chip"], bevel=0.015)
# pin-1 dot
cyl("Pin1Dot", (CX - 0.36, CY + 0.36, TOP + 0.131), 0.035, 0.004, M["silk"], 12)

pins_per_side = 12
pitch = 0.065
for i in range(pins_per_side):
    off = (i - (pins_per_side - 1) / 2) * pitch
    box("Pad", (CX + off, CY + 0.5, TOP + 0.012), (0.03, 0.09, 0.02), M["gold"])
    box("Pad", (CX + off, CY - 0.5, TOP + 0.012), (0.03, 0.09, 0.02), M["gold"])
    box("Pad", (CX + 0.5, CY + off, TOP + 0.012), (0.09, 0.03, 0.02), M["gold"])
    box("Pad", (CX - 0.5, CY + off, TOP + 0.012), (0.09, 0.03, 0.02), M["gold"])


def text(name, body, loc, size, m, extrude=0.004):
    bpy.ops.object.text_add(location=loc)
    o = bpy.context.active_object
    o.name = name
    o.data.body = body
    o.data.size = size
    o.data.extrude = extrude
    o.data.resolution_u = 2
    o.data.align_x = "CENTER"
    o.data.align_y = "CENTER"
    bpy.ops.object.convert(target="MESH")
    return assign(o, m)


text("Label_Main", "ES9038Q2M", (CX, CY + 0.08, TOP + 0.132), 0.14, M["label"])
text("Label_Brand", "ESS SABRE", (CX, CY - 0.12, TOP + 0.132), 0.085, M["silk"])
text("Silk_Name", "KOBE // HI-FI DAC v1", (0.9, -1.25, TOP + 0.003), 0.13, M["silk"], 0.002)
text("Silk_Rev", "rev.A  32-bit / 768kHz", (-1.1, -1.25, TOP + 0.003), 0.09, M["silk"], 0.002)


# ---------------------------------------------------------------- glowing traces
def trace(name, pts, m, width=0.022):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = width / 2
    cu.bevel_resolution = 0
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, (x, y) in zip(sp.points, pts):
        p.co = (x, y, TOP + 0.008, 1)
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target="MESH")
    o.select_set(False)
    return assign(o, m)


def route(x0, y0, dx, dy, segs):
    """Manhattan-ish route with 45° jogs: segs is a list of (dir, length)."""
    pts = [(x0, y0)]
    x, y = x0, y0
    dirs = {"E": (1, 0), "W": (-1, 0), "N": (0, 1), "S": (0, -1),
            "NE": (0.707, 0.707), "SE": (0.707, -0.707), "NW": (-0.707, 0.707), "SW": (-0.707, -0.707)}
    for d, length in segs:
        ux, uy = dirs[d]
        x += ux * length
        y += uy * length
        pts.append((x, y))
    return pts


# east side → output stage / caps
for i in range(5):
    y = CY + (i - 2) * 0.13
    trace(f"Trace_E{i}", route(CX + 0.55, y, 0, 0, [("E", 0.35 + i * 0.05), ("SE" if i < 2 else "NE", 0.25), ("E", 0.42 - i * 0.04)]), M["trace"])
# north side → header
for i in range(6):
    x = CX + (i - 2.5) * 0.13
    trace(f"Trace_N{i}", route(x, CY + 0.55, 0, 0, [("N", 0.25), ("NW" if i < 3 else "NE", 0.2), ("N", 0.35)]), M["trace"])
# west side → oscillator / input
for i in range(4):
    y = CY + (i - 1.5) * 0.15
    trace(f"Trace_W{i}", route(CX - 0.55, y, 0, 0, [("W", 0.3), ("SW", 0.18 + i * 0.05), ("W", 0.35)]), M["copper"], 0.018)
# south side → power
for i in range(5):
    x = CX + (i - 2) * 0.15
    trace(f"Trace_S{i}", route(x, CY - 0.55, 0, 0, [("S", 0.3), ("SE", 0.2), ("S", 0.25)]), M["copper"], 0.018)
# a few long bus lines across the board
trace("Trace_Bus1", [(-1.95, -0.95), (0.6, -0.95), (0.85, -0.7), (1.95, -0.7)], M["trace"], 0.03)
trace("Trace_Bus2", [(-1.95, 1.05), (-0.9, 1.05), (-0.7, 0.85), (1.2, 0.85)], M["trace"], 0.03)

# vias at trace ends
for o in [o for o in bpy.data.objects if o.name.startswith("Trace_")]:
    pass  # (vias are added below at fixed positions for a cleaner look)
for _ in range(26):
    x, y = random.uniform(-1.8, 1.8), random.uniform(-1.2, 1.2)
    if abs(x - CX) < 0.75 and abs(y - CY) < 0.75:
        continue
    bpy.ops.mesh.primitive_torus_add(major_radius=0.03, minor_radius=0.012, location=(x, y, TOP + 0.004),
                                     major_segments=10, minor_segments=4)
    o = bpy.context.active_object
    o.name = "Via"
    assign(o, M["gold"])

# ---------------------------------------------------------------- components
# electrolytic capacitors (output stage)
for i, (x, y) in enumerate([(1.25, 0.45), (1.6, 0.45), (1.25, -0.1), (1.6, -0.1)]):
    cyl(f"Cap{i}", (x, y, TOP + 0.22), 0.14, 0.44, M["cap"], 24)
    cyl(f"CapTop{i}", (x, y, TOP + 0.445), 0.13, 0.01, M["capTop"], 24)

# SMD resistors / caps scattered near the chip
for i in range(14):
    ang = i / 14 * math.tau
    x = CX + math.cos(ang) * 0.85
    y = CY + math.sin(ang) * 0.85
    if x > 1.0:
        continue
    o = box(f"SMD{i}", (x, y, TOP + 0.025), (0.12, 0.06, 0.05), M["smd"])
    o.rotation_euler[2] = ang
    box(f"SMDcapL{i}", (x, y, TOP + 0.026), (0.035, 0.062, 0.052), M["steel"]).rotation_euler[2] = ang

# crystal oscillator
box("Oscillator", (-1.45, 0.2, TOP + 0.06), (0.42, 0.26, 0.1), M["steel"], bevel=0.02)
text("Silk_Osc", "100MHz", (-1.45, -0.02, TOP + 0.003), 0.07, M["silk"], 0.002)

# 8-pin header along the top edge
box("HeaderBase", (-0.35, 1.25, TOP + 0.06), (1.1, 0.14, 0.12), M["plastic"])
for i in range(8):
    box(f"HeaderPin{i}", (-0.35 + (i - 3.5) * 0.13, 1.25, TOP + 0.26), (0.03, 0.03, 0.44), M["gold"])

# 3.5mm audio jack on the right edge
box("JackBody", (1.82, -0.75, TOP + 0.14), (0.5, 0.42, 0.28), M["plastic"], bevel=0.02)
o = cyl("JackBarrel", (2.12, -0.75, TOP + 0.14), 0.1, 0.18, M["steel"], 24)
o.rotation_euler[1] = math.pi / 2

# status LED
box("LED_Status", (1.6, 1.1, TOP + 0.03), (0.1, 0.06, 0.05), M["led"])

# ---------------------------------------------------------------- optimise
# Join every mesh that shares a material into one object → ~13 draw calls on the web.
by_mat = {}
for o in list(bpy.data.objects):
    if o.type != "MESH" or not o.data.materials:
        continue
    by_mat.setdefault(o.data.materials[0].name, []).append(o)
for name, objs in by_mat.items():
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    joined = bpy.context.active_object
    joined.name = name
    # merge duplicate verts + light decimation on dense parts (text, tori)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.0005)
    bpy.ops.object.mode_set(mode="OBJECT")
    for p in joined.data.polygons:
        p.use_smooth = name in ("CapBody", "CapTop", "Steel", "Gold")

# ---------------------------------------------------------------- optional preview render
if "--preview" in sys.argv:
    prev = sys.argv[sys.argv.index("--preview") + 1]
    scn = bpy.context.scene
    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    scn.collection.objects.link(cam)
    cam.location = (3.2, -4.6, 4.4)
    cam.rotation_euler = (math.radians(52), 0, math.radians(35))
    scn.camera = cam
    for loc, e in (((4, -4, 6), 900), ((-4, 3, 4), 400)):
        ld = bpy.data.lights.new("l", "AREA")
        ld.energy = e
        ld.size = 4
        lo = bpy.data.objects.new("l", ld)
        lo.location = loc
        lo.rotation_euler = (math.radians(40), 0, math.radians(30))
        scn.collection.objects.link(lo)
    scn.world = bpy.data.worlds.new("w")
    scn.world.color = (0.01, 0.015, 0.02)
    scn.render.engine = "BLENDER_EEVEE"
    scn.render.resolution_x, scn.render.resolution_y = 900, 620
    scn.render.filepath = prev
    bpy.ops.render.render(write_still=True)
    for o in (cam,):
        bpy.data.objects.remove(o)
    for o in [o for o in bpy.data.objects if o.type == "LIGHT"]:
        bpy.data.objects.remove(o)

# ---------------------------------------------------------------- export
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    export_apply=True,
    export_yup=True,
)
print("EXPORTED", out)
