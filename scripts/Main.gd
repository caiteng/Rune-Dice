extends Node2D

const VIEW_W := 390.0
const VIEW_H := 844.0
const WORLD_W := 1200.0
const WORLD_H := 1600.0
const MATCH_TIME := 360.0

const MODE_START := "start"
const MODE_PLAYING := "playing"
const MODE_UPGRADE := "upgrade"
const MODE_RESULT := "result"

var mode := MODE_START
var elapsed := 0.0
var won := false
var camera := Vector2.ZERO

var player := {}
var enemies: Array = []
var gems: Array = []
var chests: Array = []
var projectiles: Array = []
var texts: Array = []
var effects: Array = []

var weapons := {}
var passives := {}
var cooldowns := {}
var yarn_angle := 0.0
var last_move_dir := Vector2.RIGHT
var kills := 0
var spawn_timer := 0.0
var elite_timer := 55.0
var enemy_id := 1

var joystick_active := false
var joystick_id := -1
var joystick_center := Vector2.ZERO
var joystick_knob := Vector2.ZERO
var joystick_vector := Vector2.ZERO

var upgrade_options: Array = []
var start_button := Rect2(72, 530, 246, 52)
var restart_button := Rect2(72, 548, 246, 52)

var weapon_defs := {
	"purr": {"name": "猫咪呼噜圈", "desc": "身边持续伤害圈，适合清理贴脸怪。", "max": 6},
	"yarn": {"name": "毛线球环绕", "desc": "毛线球围绕猫猫旋转，碰到敌人造成伤害。", "max": 6},
	"laser": {"name": "激光笔", "desc": "自动锁定最近敌人，发射快速光点。", "max": 6},
	"claw": {"name": "猫爪飞镖", "desc": "朝移动方向连续发射爪印。", "max": 6},
}

var evolutions := {
	"purr": {"passive": "catnip", "name": "安睡结界"},
	"yarn": {"passive": "bell", "name": "星环毛线团"},
	"laser": {"passive": "night_eye", "name": "彩虹追踪光"},
	"claw": {"passive": "scratcher", "name": "暴走爪痕"},
}

var passive_defs := {
	"catnip": {"name": "猫薄荷", "desc": "所有伤害提高。", "max": 5},
	"bell": {"name": "铃铛项圈", "desc": "武器范围提高。", "max": 5},
	"night_eye": {"name": "夜视眼", "desc": "武器冷却缩短。", "max": 5},
	"scratcher": {"name": "磨爪板", "desc": "投射物速度提高。", "max": 5},
}

func _ready() -> void:
	randomize()
	set_process(true)
	queue_redraw()

func _process(delta: float) -> void:
	if mode == MODE_PLAYING:
		update_game(min(delta, 0.033))
	queue_redraw()

func start_game() -> void:
	mode = MODE_PLAYING
	elapsed = 0.0
	won = false
	player = {
		"pos": Vector2(WORLD_W * 0.5, WORLD_H * 0.5),
		"radius": 18.0,
		"hp": 100.0,
		"max_hp": 100.0,
		"speed": 165.0,
		"level": 1,
		"exp": 0.0,
		"next_exp": 8.0,
		"hurt_cd": 0.0,
	}
	enemies.clear()
	gems.clear()
	chests.clear()
	projectiles.clear()
	texts.clear()
	effects.clear()
	weapons = {"purr": 1}
	passives = {}
	cooldowns = {"laser": 0.0, "claw": 0.0}
	yarn_angle = 0.0
	last_move_dir = Vector2.RIGHT
	kills = 0
	spawn_timer = 0.0
	elite_timer = 55.0
	enemy_id = 1
	joystick_active = false
	joystick_vector = Vector2.ZERO
	update_camera()

func update_game(delta: float) -> void:
	elapsed += delta
	if elapsed >= MATCH_TIME:
		end_game(true)
		return
	update_player(delta)
	update_weapons(delta)
	update_projectiles(delta)
	update_enemies(delta)
	update_gems(delta)
	update_chests(delta)
	update_fx(delta)
	spawn_enemies(delta)
	update_camera()
	if player.hp <= 0.0:
		end_game(false)

func end_game(value: bool) -> void:
	won = value
	mode = MODE_RESULT
	joystick_active = false
	joystick_vector = Vector2.ZERO

func update_player(delta: float) -> void:
	if joystick_vector.length() > 0.05:
		last_move_dir = joystick_vector.normalized()
		player.pos += joystick_vector * player.speed * delta
	player.pos.x = clamp(player.pos.x, 40.0, WORLD_W - 40.0)
	player.pos.y = clamp(player.pos.y, 40.0, WORLD_H - 40.0)
	player.hurt_cd = max(0.0, player.hurt_cd - delta)

func update_weapons(delta: float) -> void:
	var cd_mul := 1.0 / (1.0 + get_passive_level("night_eye") * 0.08)
	yarn_angle += delta * (2.8 + get_weapon_level("yarn") * 0.15)
	if get_weapon_level("laser") > 0:
		cooldowns.laser -= delta
		var interval: float = max(0.22, (0.78 - get_weapon_level("laser") * 0.06) * cd_mul)
		if cooldowns.laser <= 0.0:
			fire_laser()
			cooldowns.laser = interval
	if get_weapon_level("claw") > 0:
		cooldowns.claw -= delta
		var interval: float = max(0.18, (0.64 - get_weapon_level("claw") * 0.055) * cd_mul)
		if cooldowns.claw <= 0.0:
			fire_claw()
			cooldowns.claw = interval
	apply_purr_damage(delta)
	apply_yarn_damage()

func apply_purr_damage(delta: float) -> void:
	var level := get_weapon_level("purr")
	if level <= 0:
		return
	var radius := (52.0 + level * 8.0) * range_mul()
	var damage := (12.0 + level * 3.0) * damage_mul() * delta
	for enemy in enemies:
		if enemy.pos.distance_to(player.pos) <= radius + enemy.radius:
			hurt_enemy(enemy, damage, Color("#b8f5ff"))
			var push: Vector2 = (enemy.pos - player.pos).normalized()
			enemy.pos += push * 12.0 * delta

func apply_yarn_damage() -> void:
	var level := get_weapon_level("yarn")
	if level <= 0:
		return
	var count: int = min(5, 1 + int((level + 1) / 2))
	var orbit := (68.0 + level * 7.0) * range_mul()
	var damage := (10.0 + level * 3.0) * damage_mul()
	for i in range(count):
		var angle := yarn_angle + TAU * float(i) / float(count)
		var orb: Vector2 = player.pos + Vector2(cos(angle), sin(angle)) * orbit
		for enemy in enemies:
			if enemy.get("yarn_cd", 0.0) <= elapsed and orb.distance_to(enemy.pos) <= 14.0 + enemy.radius:
				hurt_enemy(enemy, damage, Color("#ffd36b"))
				enemy.yarn_cd = elapsed + 0.28

func fire_laser() -> void:
	var level := get_weapon_level("laser")
	var target := nearest_enemy()
	if target.is_empty():
		return
	var shots := 2 if level >= 5 else 1
	for i in range(shots):
		var dir: Vector2 = (target.pos - player.pos + Vector2(i * 12.0, -i * 8.0)).normalized()
		projectiles.append({
			"pos": player.pos,
			"vel": dir * 430.0 * projectile_speed_mul(),
			"radius": 5.0,
			"life": 1.05,
			"damage": (18.0 + level * 5.0) * damage_mul(),
			"pierce": 1 if level >= 4 else 0,
			"color": Color("#82d9ff"),
			"hit": {},
		})

func fire_claw() -> void:
	var level := get_weapon_level("claw")
	var count := 3 if level >= 5 else 2 if level >= 3 else 1
	var base := last_move_dir.angle()
	for i in range(count):
		var spread := (float(i) - float(count - 1) * 0.5) * 0.18
		var dir := Vector2.from_angle(base + spread)
		projectiles.append({
			"pos": player.pos,
			"vel": dir * 370.0 * projectile_speed_mul(),
			"radius": 7.0,
			"life": 0.85,
			"damage": (14.0 + level * 4.0) * damage_mul(),
			"pierce": 1 if level >= 4 else 0,
			"color": Color("#ff9f7a"),
			"hit": {},
		})

func update_projectiles(delta: float) -> void:
	for projectile in projectiles:
		projectile.pos += projectile.vel * delta
		projectile.life -= delta
		for enemy in enemies:
			if enemy.dead or projectile.hit.has(enemy.id):
				continue
			if projectile.pos.distance_to(enemy.pos) <= projectile.radius + enemy.radius:
				hurt_enemy(enemy, projectile.damage, projectile.color)
				projectile.hit[enemy.id] = true
				if projectile.pierce > 0:
					projectile.pierce -= 1
				else:
					projectile.life = 0.0
				break
	projectiles = projectiles.filter(func(p): return p.life > 0.0)

func update_enemies(delta: float) -> void:
	for enemy in enemies:
		enemy.flash = max(0.0, enemy.flash - delta)
		var dir: Vector2 = (player.pos - enemy.pos).normalized()
		enemy.pos += dir * enemy.speed * delta
		if enemy.pos.distance_to(player.pos) < enemy.radius + player.radius:
			if player.hurt_cd <= 0.0:
				player.hp -= enemy.damage
				player.hurt_cd = 0.55
				add_text(player.pos + Vector2(0, -24), "-" + str(enemy.damage), Color("#ff7777"))
			enemy.pos -= dir * 20.0
	for enemy in enemies:
		if enemy.dead:
			kills += 1
			if enemy.elite:
				chests.append({"pos": enemy.pos, "radius": 14.0, "opened": false})
				gems.append({"pos": enemy.pos + Vector2(10, 0), "radius": 8.0, "value": 6.0})
			else:
				gems.append({"pos": enemy.pos, "radius": 5.0, "value": 1.0})
	enemies = enemies.filter(func(e): return not e.dead)

func update_gems(delta: float) -> void:
	var pickup_radius := 42.0
	for gem in gems:
		var dist: float = gem.pos.distance_to(player.pos)
		if dist < pickup_radius:
			var dir: Vector2 = (player.pos - gem.pos).normalized()
			gem.pos += dir * 420.0 * delta
		if dist < player.radius + gem.radius + 3.0:
			gem.collected = true
			gain_exp(gem.value)
	gems = gems.filter(func(g): return not g.get("collected", false))

func update_chests(_delta: float) -> void:
	for chest in chests:
		if chest.pos.distance_to(player.pos) < player.radius + chest.radius + 8.0:
			chest.opened = true
			open_chest(chest.pos)
	chests = chests.filter(func(c): return not c.get("opened", false))

func open_chest(pos: Vector2) -> void:
	var evolved := try_evolve_weapon()
	if evolved != "":
		add_text(pos + Vector2(0, -20), "进化：" + evolved, Color("#ffd36b"))
		player.hp = min(player.max_hp, player.hp + 12.0)
	else:
		var options := create_upgrade_options()
		if not options.is_empty():
			var option: Dictionary = options[0]
			apply_upgrade_option(option)
			add_text(pos + Vector2(0, -20), "宝箱强化", Color("#ffd36b"))

func try_evolve_weapon() -> String:
	for id in evolutions.keys():
		if get_weapon_level(id) >= weapon_defs[id].max and get_passive_level(evolutions[id].passive) > 0 and not str(weapons.get(id, "")).begins_with("e"):
			weapons[id] = "e" + str(weapon_defs[id].max)
			return evolutions[id].name
	return ""

func gain_exp(value: float) -> void:
	player.exp += value
	if player.exp >= player.next_exp:
		player.exp -= player.next_exp
		player.level += 1
		player.next_exp = floor(8.0 + player.level * 5.5)
		start_upgrade()

func start_upgrade() -> void:
	mode = MODE_UPGRADE
	joystick_active = false
	joystick_vector = Vector2.ZERO
	upgrade_options = create_upgrade_options()

func create_upgrade_options() -> Array:
	var pool: Array = []
	for id in weapon_defs.keys():
		var level := get_weapon_level(id)
		var max_level: int = weapon_defs[id].max
		if level == 0 or level < max_level:
			pool.append({
				"type": "weapon",
				"id": id,
				"title": ("获得 " if level == 0 else "") + weapon_defs[id].name + ("" if level == 0 else " Lv." + str(level + 1)),
				"desc": weapon_defs[id].desc if level == 0 else weapon_upgrade_desc(id, level + 1),
			})
	for id in passive_defs.keys():
		var level := get_passive_level(id)
		var max_level: int = passive_defs[id].max
		if level == 0 or level < max_level:
			pool.append({
				"type": "passive",
				"id": id,
				"title": ("获得 " if level == 0 else "") + passive_defs[id].name + ("" if level == 0 else " Lv." + str(level + 1)),
				"desc": passive_defs[id].desc if level == 0 else "继续强化：" + passive_defs[id].desc,
			})
	pool.append({"type": "heal", "id": "heal", "title": "小鱼干补给", "desc": "立刻恢复 25 点生命。"})
	pool.shuffle()
	return pool.slice(0, 3)

func apply_upgrade(index: int) -> void:
	if index < 0 or index >= upgrade_options.size():
		return
	var option: Dictionary = upgrade_options[index]
	apply_upgrade_option(option)
	mode = MODE_PLAYING

func apply_upgrade_option(option: Dictionary) -> void:
	if option.type == "weapon":
		weapons[option.id] = get_weapon_level(option.id) + 1
	elif option.type == "passive":
		passives[option.id] = get_passive_level(option.id) + 1
	else:
		player.hp = min(player.max_hp, player.hp + 25.0)

func spawn_enemies(delta: float) -> void:
	spawn_timer -= delta
	elite_timer -= delta
	var minute := elapsed / 60.0
	var interval: float = clamp(0.82 - minute * 0.11, 0.18, 0.82)
	if spawn_timer <= 0.0:
		var count := 1 + int(minute / 1.5)
		for i in range(count):
			spawn_enemy(false)
		spawn_timer = interval
	if elite_timer <= 0.0:
		spawn_enemy(true)
		elite_timer = 60.0

func spawn_enemy(elite: bool) -> void:
	var angle := randf() * TAU
	var pos: Vector2 = player.pos + Vector2(cos(angle), sin(angle)) * 360.0
	pos.x = clamp(pos.x, 20.0, WORLD_W - 20.0)
	pos.y = clamp(pos.y, 20.0, WORLD_H - 20.0)
	var minute := elapsed / 60.0
	var roll := randf()
	var fast := minute > 2.0 and roll < 0.24
	var tank := minute > 3.0 and roll > 0.72
	var hp := 30.0 + minute * 7.0
	var speed := 66.0 + minute * 4.0
	var radius := 15.0
	var damage := 10
	var color := Color("#d9e6ff")
	if fast:
		hp = 20.0 + minute * 5.0
		speed = 116.0 + minute * 4.0
		radius = 12.0
		color = Color("#ffcf4d")
	if tank:
		hp = 54.0 + minute * 12.0
		speed = 44.0
		radius = 18.0
		damage = 14
		color = Color("#755b46")
	if elite:
		hp = 180.0 + minute * 45.0
		speed = 54.0
		radius = 24.0
		damage = 20
		color = Color("#7b5cff")
	enemies.append({
		"id": enemy_id,
		"pos": pos,
		"radius": radius,
		"hp": hp,
		"max_hp": hp,
		"speed": speed,
		"damage": damage,
		"elite": elite,
		"color": color,
		"flash": 0.0,
		"dead": false,
	})
	enemy_id += 1

func update_fx(delta: float) -> void:
	for item in texts:
		item.pos.y -= 24.0 * delta
		item.life -= delta
	texts = texts.filter(func(t): return t.life > 0.0)
	for item in effects:
		item.life -= delta
		item.radius += 36.0 * delta
	effects = effects.filter(func(e): return e.life > 0.0)

func hurt_enemy(enemy: Dictionary, amount: float, color: Color) -> void:
	enemy.hp -= amount
	enemy.flash = 0.08
	if randf() < 0.18 or amount > 20.0:
		add_text(enemy.pos + Vector2(0, -enemy.radius), str(ceil(amount)), color)
	effects.append({"pos": enemy.pos, "radius": 4.0, "color": color, "life": 0.18})
	if enemy.hp <= 0.0:
		enemy.dead = true

func add_text(pos: Vector2, value, color: Color) -> void:
	texts.append({"pos": pos, "text": str(value), "color": color, "life": 0.7})

func update_camera() -> void:
	camera.x = clamp(player.pos.x - VIEW_W * 0.5, 0.0, WORLD_W - VIEW_W)
	camera.y = clamp(player.pos.y - VIEW_H * 0.5, 0.0, WORLD_H - VIEW_H)

func nearest_enemy() -> Dictionary:
	var best := {}
	var best_dist := INF
	for enemy in enemies:
		var dist: float = enemy.pos.distance_to(player.pos)
		if dist < best_dist:
			best = enemy
			best_dist = dist
	return best

func get_weapon_level(id: String) -> int:
	var value = weapons.get(id, 0)
	if value is String and String(value).begins_with("e"):
		return weapon_defs[id].max + 2
	return int(value)

func is_evolved(id: String) -> bool:
	var value = weapons.get(id, 0)
	return value is String and String(value).begins_with("e")

func get_passive_level(id: String) -> int:
	return int(passives.get(id, 0))

func damage_mul() -> float:
	return 1.0 + get_passive_level("catnip") * 0.12

func range_mul() -> float:
	return 1.0 + get_passive_level("bell") * 0.08

func projectile_speed_mul() -> float:
	return 1.0 + get_passive_level("scratcher") * 0.12

func weapon_upgrade_desc(id: String, level: int) -> String:
	if id == "purr":
		return "呼噜圈伤害和范围提高，升到 " + str(level) + " 级。"
	if id == "yarn":
		return "毛线球数量、范围或转速提高，升到 " + str(level) + " 级。"
	if id == "laser":
		return "激光冷却缩短并提高伤害，升到 " + str(level) + " 级。"
	return "猫爪飞镖更快更强，升到 " + str(level) + " 级。"

func _unhandled_input(event: InputEvent) -> void:
	var pos := Vector2.ZERO
	var pressed := false
	var released := false
	var dragged := false
	var pointer_id := 0
	if event is InputEventScreenTouch:
		pos = event.position
		pressed = event.pressed
		released = not event.pressed
		pointer_id = event.index
	elif event is InputEventScreenDrag:
		pos = event.position
		dragged = true
		pointer_id = event.index
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		pos = event.position
		pressed = event.pressed
		released = not event.pressed
	elif event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		pos = event.position
		dragged = true
	else:
		return

	if pressed:
		handle_press(pos, pointer_id)
	elif dragged:
		handle_drag(pos, pointer_id)
	elif released:
		handle_release(pointer_id)

func handle_press(pos: Vector2, pointer_id: int) -> void:
	if mode == MODE_START:
		if start_button.has_point(pos):
			start_game()
		return
	if mode == MODE_RESULT:
		if restart_button.has_point(pos):
			start_game()
		return
	if mode == MODE_UPGRADE:
		for i in range(upgrade_options.size()):
			if upgrade_rect(i).has_point(pos):
				apply_upgrade(i)
				return
	if mode != MODE_PLAYING:
		return
	if pos.y < VIEW_H * 0.48:
		return
	joystick_active = true
	joystick_id = pointer_id
	joystick_center = pos
	joystick_knob = pos
	joystick_vector = Vector2.ZERO

func handle_drag(pos: Vector2, pointer_id: int) -> void:
	if not joystick_active or pointer_id != joystick_id:
		return
	var offset := pos - joystick_center
	var max_radius := 48.0
	if offset.length() > max_radius:
		offset = offset.normalized() * max_radius
	joystick_knob = joystick_center + offset
	joystick_vector = offset / max_radius if offset.length() > 4.0 else Vector2.ZERO

func handle_release(pointer_id: int) -> void:
	if pointer_id != joystick_id:
		return
	joystick_active = false
	joystick_id = -1
	joystick_vector = Vector2.ZERO

func _draw() -> void:
	draw_background()
	if mode == MODE_START:
		draw_start()
		return
	if not player.is_empty():
		draw_world()
		draw_hud()
		draw_joystick()
	if mode == MODE_UPGRADE:
		draw_upgrade()
	elif mode == MODE_RESULT:
		draw_result()

func draw_background() -> void:
	draw_rect(Rect2(Vector2.ZERO, Vector2(VIEW_W, VIEW_H)), Color("#151a2b"))
	for x in range(-48, int(VIEW_W) + 48, 48):
		var px := float(x) - fmod(camera.x, 48.0)
		draw_line(Vector2(px, 0), Vector2(px, VIEW_H), Color(1, 1, 1, 0.035))
	for y in range(-48, int(VIEW_H) + 48, 48):
		var py := float(y) - fmod(camera.y, 48.0)
		draw_line(Vector2(0, py), Vector2(VIEW_W, py), Color(1, 1, 1, 0.035))

func draw_world() -> void:
	draw_set_transform(-camera)
	for gem in gems:
		draw_diamond(gem.pos, gem.radius, Color("#b47cff") if gem.value > 1.0 else Color("#67e8f9"))
	for chest in chests:
		draw_chest(chest.pos)
	draw_weapon_shapes()
	for projectile in projectiles:
		draw_circle(projectile.pos, projectile.radius, projectile.color)
	for enemy in enemies:
		draw_enemy(enemy)
	draw_player()
	for effect in effects:
		draw_arc(effect.pos, effect.radius, 0, TAU, 18, Color(effect.color, clamp(effect.life / 0.18, 0.0, 1.0)), 2.0)
	for item in texts:
		draw_string(ThemeDB.fallback_font, item.pos, item.text, HORIZONTAL_ALIGNMENT_CENTER, -1, 13, Color(item.color, clamp(item.life / 0.7, 0.0, 1.0)))
	draw_set_transform(Vector2.ZERO)

func draw_weapon_shapes() -> void:
	var purr := get_weapon_level("purr")
	if purr > 0:
		var radius := (52.0 + purr * 8.0) * range_mul()
		draw_circle(player.pos, radius, Color(0.47, 0.86, 1.0, 0.11))
		draw_arc(player.pos, radius, 0, TAU, 80, Color(0.72, 0.96, 1.0, 0.58), 2.0)
	var yarn := get_weapon_level("yarn")
	if yarn > 0:
		var count: int = min(5, 1 + int((yarn + 1) / 2))
		var radius := (68.0 + yarn * 7.0) * range_mul()
		for i in range(count):
			var angle := yarn_angle + TAU * float(i) / float(count)
			draw_circle(player.pos + Vector2(cos(angle), sin(angle)) * radius, 13.0, Color("#ffd36b"))

func draw_enemy(enemy: Dictionary) -> void:
	draw_circle(enemy.pos, enemy.radius, Color.WHITE if enemy.flash > 0.0 else enemy.color)
	var bar_w: float = enemy.radius * 2.0
	draw_rect(Rect2(enemy.pos + Vector2(-enemy.radius, -enemy.radius - 8.0), Vector2(bar_w, 3.0)), Color(0, 0, 0, 0.35))
	draw_rect(Rect2(enemy.pos + Vector2(-enemy.radius, -enemy.radius - 8.0), Vector2(bar_w * clamp(enemy.hp / enemy.max_hp, 0.0, 1.0), 3.0)), Color("#ff6262"))
	if enemy.elite:
		draw_rect(Rect2(enemy.pos - Vector2(enemy.radius + 3.0, enemy.radius + 3.0), Vector2(enemy.radius * 2.0 + 6.0, enemy.radius * 2.0 + 6.0)), Color("#ffd36b"), false, 2.0)

func draw_player() -> void:
	var pos: Vector2 = player.pos
	draw_circle(pos, player.radius, Color.WHITE if player.hurt_cd > 0.0 else Color("#f5d6a1"))
	draw_polygon([pos + Vector2(-12, -12), pos + Vector2(-7, -27), pos + Vector2(1, -13)], [Color("#f5d6a1")])
	draw_polygon([pos + Vector2(12, -12), pos + Vector2(7, -27), pos + Vector2(-1, -13)], [Color("#f5d6a1")])
	draw_circle(pos + Vector2(-6, -3), 2.2, Color("#22263a"))
	draw_circle(pos + Vector2(6, -3), 2.2, Color("#22263a"))

func draw_hud() -> void:
	draw_rect(Rect2(12, 12, VIEW_W - 24, 88), Color(0.03, 0.04, 0.07, 0.62))
	draw_bar(Rect2(24, 28, 150, 9), player.hp / player.max_hp, Color("#ff7474"), Color("#3a2230"))
	draw_bar(Rect2(24, 45, 150, 8), player.exp / player.next_exp, Color("#67e8f9"), Color("#203646"))
	draw_text("Lv." + str(player.level), Vector2(188, 40), 16, Color("#f8f1dc"))
	draw_text("击败 " + str(kills), Vector2(188, 61), 12, Color("#f8f1dc"))
	draw_text(time_text(MATCH_TIME - elapsed), Vector2(310, 42), 18, Color("#f8f1dc"))
	draw_text("坚持到天亮", Vector2(303, 63), 12, Color("#d7deef"))
	var x := 24.0
	for id in weapons.keys():
		draw_badge(x, 76, weapon_defs[id].name.substr(0, 1) + ("★" if is_evolved(id) else str(get_weapon_level(id))), Color("#38476e"))
		x += 42.0
	for id in passives.keys():
		draw_badge(x, 76, passive_defs[id].name.substr(0, 1) + str(passives[id]), Color("#4a3f63"))
		x += 42.0

func draw_start() -> void:
	draw_panel(Rect2(26, 280, 338, 300))
	draw_text_center("试玩版 0.1", Vector2(195, 322), 13, Color("#ffd36b"))
	draw_text_center("猫猫守夜", Vector2(195, 377), 42, Color("#f8f1dc"))
	draw_text_center("拖动下半屏浮动摇杆，守住夜晚房间。", Vector2(195, 430), 15, Color("#d7deef"))
	draw_button(start_button, "开始守夜")
	draw_text_center("自动攻击 · 升级三选一 · 坚持 6 分钟", Vector2(195, 612), 13, Color("#9ea9c8"))

func draw_upgrade() -> void:
	draw_overlay()
	draw_panel(Rect2(24, 190, 342, 430))
	draw_text_center("升级", Vector2(195, 228), 13, Color("#ffd36b"))
	draw_text_center("选择一个强化", Vector2(195, 270), 24, Color("#f8f1dc"))
	for i in range(upgrade_options.size()):
		var rect := upgrade_rect(i)
		draw_rect(rect, Color("#252f4a"))
		draw_rect(rect, Color(1, 1, 1, 0.10), false, 1.0)
		draw_text(upgrade_options[i].title, rect.position + Vector2(14, 27), 16, Color.WHITE)
		draw_text(upgrade_options[i].desc, rect.position + Vector2(14, 53), 12, Color("#bdc8e7"))

func draw_result() -> void:
	draw_overlay()
	draw_panel(Rect2(26, 306, 338, 280))
	draw_text_center("天亮了" if won else "守夜失败", Vector2(195, 348), 13, Color("#ffd36b"))
	draw_text_center("猫猫守住了房间" if won else "猫猫被梦魇包围了", Vector2(195, 392), 24, Color("#f8f1dc"))
	draw_text_center("坚持 " + time_text(elapsed) + "，清理 " + str(kills) + " 个怪物，达到 " + str(player.level) + " 级。", Vector2(195, 448), 14, Color("#d7deef"))
	draw_button(restart_button, "再来一局")

func draw_joystick() -> void:
	if not joystick_active or mode != MODE_PLAYING:
		return
	draw_circle(joystick_center, 48.0, Color(1, 1, 1, 0.12))
	draw_arc(joystick_center, 48.0, 0, TAU, 64, Color(1, 1, 1, 0.35), 2.0)
	draw_circle(joystick_knob, 20.0, Color("#ffd36b"))

func draw_overlay() -> void:
	draw_rect(Rect2(Vector2.ZERO, Vector2(VIEW_W, VIEW_H)), Color(0.03, 0.04, 0.07, 0.58))

func draw_panel(rect: Rect2) -> void:
	draw_rect(rect, Color(0.09, 0.12, 0.19, 0.94))
	draw_rect(rect, Color(1, 1, 1, 0.14), false, 1.0)

func draw_button(rect: Rect2, label: String) -> void:
	draw_rect(rect, Color("#ffd36b"))
	draw_text_center(label, rect.get_center() + Vector2(0, 6), 18, Color("#1b1b24"))

func draw_bar(rect: Rect2, value: float, fill: Color, bg: Color) -> void:
	draw_rect(rect, bg)
	draw_rect(Rect2(rect.position, Vector2(rect.size.x * clamp(value, 0.0, 1.0), rect.size.y)), fill)

func draw_badge(x: float, y: float, label: String, color: Color) -> void:
	var rect := Rect2(x, y, 38, 16)
	draw_rect(rect, color)
	draw_text_center(label, rect.get_center() + Vector2(0, 4), 10, Color("#f8f1dc"))

func draw_diamond(pos: Vector2, radius: float, color: Color) -> void:
	draw_polygon([pos + Vector2(0, -radius), pos + Vector2(radius, 0), pos + Vector2(0, radius), pos + Vector2(-radius, 0)], [color, color, color, color])

func draw_chest(pos: Vector2) -> void:
	draw_rect(Rect2(pos - Vector2(13, 9), Vector2(26, 18)), Color("#7a4b2a"))
	draw_rect(Rect2(pos - Vector2(13, 9), Vector2(26, 8)), Color("#b9783f"))
	draw_rect(Rect2(pos - Vector2(3, -9), Vector2(6, 18)), Color("#ffd36b"))
	draw_rect(Rect2(pos - Vector2(13, 9), Vector2(26, 18)), Color("#ffd36b"), false, 1.5)

func draw_text(text: String, pos: Vector2, size: int, color: Color) -> void:
	draw_string(ThemeDB.fallback_font, pos, text, HORIZONTAL_ALIGNMENT_LEFT, -1, size, color)

func draw_text_center(text: String, pos: Vector2, size: int, color: Color) -> void:
	draw_string(ThemeDB.fallback_font, pos, text, HORIZONTAL_ALIGNMENT_CENTER, -1, size, color)

func upgrade_rect(index: int) -> Rect2:
	return Rect2(48, 304 + index * 92, 294, 76)

func time_text(value: float) -> String:
	var safe := int(max(0.0, ceil(value)))
	return str(int(safe / 60)) + ":" + str(safe % 60).pad_zeros(2)
