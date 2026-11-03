DO $$
DECLARE
    v_col_a UUID;
    v_col_b UUID;
    v_user_a UUID;
    v_user_b UUID;
    v_dept_a UUID;
    v_dept_b UUID;
    v_club_a UUID;
    v_club_b UUID;
    v_event_a UUID;
    v_event_b UUID;
BEGIN
    -- Clean existing test rows if any
    DELETE FROM deletion_verifications;
    DELETE FROM event_registrations;
    DELETE FROM event_gallery_images;
    DELETE FROM events;
    DELETE FROM memberships;
    DELETE FROM club_departments;
    DELETE FROM clubs;
    DELETE FROM departments;
    DELETE FROM users;
    DELETE FROM colleges WHERE slug IN ('lbrce', 'vrsec');

    -- 1. Colleges
    INSERT INTO colleges (name, slug) VALUES ('LBRCE College', 'lbrce') RETURNING id INTO v_col_a;
    INSERT INTO colleges (name, slug) VALUES ('VRSEC College', 'vrsec') RETURNING id INTO v_col_b;

    -- 2. Users
    INSERT INTO users (college_id, name, email, role, is_active)
    VALUES (v_col_a, 'Admin A', 'admin@lbrce.in', 'COLLEGE_ADMIN', true) RETURNING id INTO v_user_a;

    INSERT INTO users (college_id, name, email, role, is_active)
    VALUES (v_col_b, 'Admin B', 'admin@vrsec.in', 'COLLEGE_ADMIN', true) RETURNING id INTO v_user_b;

    -- 3. Departments
    INSERT INTO departments (college_id, name, short_code)
    VALUES (v_col_a, 'Computer Science', 'CSE') RETURNING id INTO v_dept_a;

    INSERT INTO departments (college_id, name, short_code)
    VALUES (v_col_b, 'Information Technology', 'IT') RETURNING id INTO v_dept_b;

    -- 4. Clubs
    INSERT INTO clubs (college_id, name, club_type, created_by_user_id)
    VALUES (v_col_a, 'Coding Club', 'DEPARTMENTAL', v_user_a) RETURNING id INTO v_club_a;

    INSERT INTO clubs (college_id, name, club_type, created_by_user_id)
    VALUES (v_col_b, 'Robotics Club', 'DEPARTMENTAL', v_user_b) RETURNING id INTO v_club_b;

    -- 5. Club Departments
    INSERT INTO club_departments (college_id, club_id, department_id)
    VALUES (v_col_a, v_club_a, v_dept_a);

    INSERT INTO club_departments (college_id, club_id, department_id)
    VALUES (v_col_b, v_club_b, v_dept_b);

    -- 6. Memberships
    INSERT INTO memberships (college_id, user_id, club_id, role)
    VALUES (v_col_a, v_user_a, v_club_a, 'MANAGER');

    INSERT INTO memberships (college_id, user_id, club_id, role)
    VALUES (v_col_b, v_user_b, v_club_b, 'MANAGER');

    -- 7. Events
    INSERT INTO events (college_id, club_id, title, description, location, start_at, capacity)
    VALUES (v_col_a, v_club_a, 'Hackathon 2026', 'Code all night', 'Lab 1', now() + INTERVAL '1 day', 100)
    RETURNING id INTO v_event_a;

    INSERT INTO events (college_id, club_id, title, description, location, start_at, capacity)
    VALUES (v_col_b, v_club_b, 'RoboWars 2026', 'Bot battles', 'Arena', now() + INTERVAL '2 days', 50)
    RETURNING id INTO v_event_b;

    -- 8. Event Gallery
    INSERT INTO event_gallery_images (college_id, event_id, image_url, image_public_id, position)
    VALUES (v_col_a, v_event_a, 'https://res.cloudinary.com/demo/image/upload/hack1.jpg', 'hack1_pub', 0);

    INSERT INTO event_gallery_images (college_id, event_id, image_url, image_public_id, position)
    VALUES (v_col_b, v_event_b, 'https://res.cloudinary.com/demo/image/upload/robo1.jpg', 'robo1_pub', 0);

    -- 9. Event Registrations
    INSERT INTO event_registrations (college_id, event_id, user_id)
    VALUES (v_col_a, v_event_a, v_user_a);

    INSERT INTO event_registrations (college_id, event_id, user_id)
    VALUES (v_col_b, v_event_b, v_user_b);

    -- 10. Deletion Verifications
    INSERT INTO deletion_verifications (college_id, admin_id, target_type, target_id, code_hash, expires_at)
    VALUES (v_col_a, v_user_a, 'USER', v_user_a, 'hash_abc', now() + INTERVAL '10 minutes');

    INSERT INTO deletion_verifications (college_id, admin_id, target_type, target_id, code_hash, expires_at)
    VALUES (v_col_b, v_user_b, 'USER', v_user_b, 'hash_xyz', now() + INTERVAL '10 minutes');
END
$$;
