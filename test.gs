function test() {
  const api = init({
    username: "username",
    password: "password"
  });

  const status = api.runActivityAttendanceReport(api.schoolCode, "2023-11-10", "2023-11-13", [8178]);

  console.log(status[0]);
}
