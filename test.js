import axios from "axios";
import FormData from "form-data";

const handle = "https://scontent.whatsapp.net/v/t61.29466-34/454703841_550238954012690_3929490088877798474_n.png?ccb=1-7&_nc_sid=8b1bef&_nc_ohc=UsmvMbNBadsQ7kNvgFpBIfK&_nc_ht=scontent.whatsapp.net&edm=AH51TzQEAAAA&oh=01_Q5AaIHO7RA7k986urkKcGgxqpmv5am-LDyAclTc_kuHsbkg7&oe=6710BF98";
const bpid = 241683569037594;
const access_token = "EAAVZBobCt7AcBO8trGDsP8t4bTe2mRA7sNdZCQ346G9ZANwsi4CVdKM5MwYwaPlirOHAcpDQ63LoHxPfx81tN9h2SUIHc1LUeEByCzS8eQGH2J7wwe9tqAxZAdwr4SxkXGku2l7imqWY16qemnlOBrjYH3dMjN4gamsTikIROudOL3ScvBzwkuShhth0rR9P";

await getMediaID(handle, bpid, access_token);
