<?php
// backend/attendance.php
require_once 'config.php';

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    case 'GET':
        // ?employee_id=5&month=2025-12
        $empId = isset($_GET['employee_id']) ? (int)$_GET['employee_id'] : null;
        $month = $_GET['month'] ?? null;   // e.g. "2025-12"

        if (!$empId || !$month) {
            echo json_encode(['error' => 'employee_id and month are required']); break;
        }

        [$yr, $mo] = explode('-', $month);
        $from = "$yr-$mo-01";
        $to   = date('Y-m-t', strtotime($from));

        $stmt = $db->prepare(
            "SELECT att_date, status, in_time, out_time, work_hours, idle_hours
             FROM attendance
             WHERE employee_id = ? AND att_date BETWEEN ? AND ?
             ORDER BY att_date"
        );
        $stmt->bind_param('iss', $empId, $from, $to);
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

        // Summary
        $present = 0; $absent = 0;
        foreach ($rows as $r) {
            if ($r['status'] === 'present') $present++;
            if ($r['status'] === 'absent')  $absent++;
        }

        echo json_encode([
            'success' => true,
            'data'    => $rows,
            'summary' => ['present' => $present, 'absent' => $absent, 'total' => $present + $absent],
        ]);
        break;

    case 'POST':
        // Upsert a single day record
        $body = json_decode(file_get_contents('php://input'), true);
        $stmt = $db->prepare(
            "INSERT INTO attendance (employee_id, att_date, status, in_time, out_time, work_hours, idle_hours)
             VALUES (?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE
               status=VALUES(status), in_time=VALUES(in_time),
               out_time=VALUES(out_time), work_hours=VALUES(work_hours), idle_hours=VALUES(idle_hours)"
        );
        $stmt->bind_param('issssdd',
            $body['employee_id'], $body['att_date'], $body['status'],
            $body['in_time'], $body['out_time'],
            $body['work_hours'], $body['idle_hours']
        );
        $stmt->execute();
        echo json_encode(['success' => true, 'id' => $db->insert_id]);
        break;
}

$db->close();
