// Ambil token dari localStorage
export const getToken = () => {
  return localStorage.getItem("token");
};

// Simpan token ke localStorage
export const setToken = (token) => {
  localStorage.setItem("token", token);
};

// Hapus token dari localStorage
export const clearToken = () => {
  localStorage.removeItem("token");
};
